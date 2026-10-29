// Fila offline das corridas. Sem internet (ou com o servidor fora do ar), a
// corrida fica guardada no celular e sobe sozinha quando a rede volta.
// O clientId faz o backend ignorar um reenvio da mesma corrida.

import { auth } from "@/config/firebase";
import { ApiError } from "@/services/apiClient";
import { saveActivity } from "@/services/activitiesApi";
import { completePlannedRun, loadPlannedRun } from "@/services/plannedRun";
import type { ActivityData } from "@/types";

export type QueuedRunPayload = ActivityData & { clientId: string; finishedAt: string };

export interface QueuedRun {
  payload: QueuedRunPayload;
  workoutId: number | null;
  queuedAt: number;
}

export interface FlushResult {
  sent: QueuedRun[];
  rejected: { run: QueuedRun; reason: string }[];
  remaining: number;
}

const storageKey = (uid: string) => `runnex-offline-runs:${uid}`;

export function newClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getQueuedRuns(uid: string): QueuedRun[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(uid)) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(uid: string, runs: QueuedRun[]) {
  if (runs.length === 0) localStorage.removeItem(storageKey(uid));
  else localStorage.setItem(storageKey(uid), JSON.stringify(runs));
}

/** Guarda a corrida no celular. Retorna false se o armazenamento recusar (cheio ou bloqueado). */
export function enqueueRun(uid: string, payload: QueuedRunPayload, workoutId: number | null): boolean {
  try {
    const runs = getQueuedRuns(uid).filter((run) => run.payload.clientId !== payload.clientId);
    runs.push({ payload, workoutId, queuedAt: Date.now() });
    writeQueue(uid, runs);
    return true;
  } catch {
    return false;
  }
}

function removeQueuedRun(uid: string, clientId: string) {
  try {
    writeQueue(uid, getQueuedRuns(uid).filter((run) => run.payload.clientId !== clientId));
  } catch {
    // Se não der para remover, o reenvio é ignorado pelo backend (mesmo clientId).
  }
}

/**
 * Falha que vale tentar de novo depois: sem rede (fetch lança TypeError),
 * servidor fora do ar ou acordando, limite de envios, sessão expirada ou
 * e-mail ainda não confirmado. As outras (400, 422...) são recusas definitivas.
 */
export function isRetryableSaveError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  return error.status === 401 || error.status === 403 || error.status === 408 || error.status === 429 || error.status >= 500;
}

const inFlight = new Map<string, Promise<FlushResult>>();

/** Envia a fila em ordem. Para no primeiro erro temporário; recusas definitivas saem da fila. */
export function flushQueuedRuns(uid: string): Promise<FlushResult> {
  const running = inFlight.get(uid);
  if (running) return running;

  const job = (async (): Promise<FlushResult> => {
    const result: FlushResult = { sent: [], rejected: [], remaining: 0 };
    for (const run of getQueuedRuns(uid)) {
      if (auth.currentUser?.uid !== uid) break;
      try {
        const saved = await saveActivity(run.payload);
        removeQueuedRun(uid, run.payload.clientId);
        result.sent.push(run);
        if (run.workoutId !== null) {
          try {
            const workout = await loadPlannedRun(uid, run.workoutId);
            await completePlannedRun(uid, workout, Number(saved.id));
          } catch {
            // A corrida já subiu; o vínculo com o treino pode ser feito na agenda.
          }
        }
      } catch (error) {
        if (isRetryableSaveError(error)) break;
        removeQueuedRun(uid, run.payload.clientId);
        result.rejected.push({ run, reason: error instanceof Error ? error.message : "Corrida recusada." });
      }
    }
    result.remaining = getQueuedRuns(uid).length;
    return result;
  })();

  inFlight.set(uid, job);
  return job.finally(() => inFlight.delete(uid));
}
