import { Capacitor, registerPlugin } from "@capacitor/core";
import { auth } from "@/config/firebase";
import { importSleepBatch } from "@/services/recoveryApi";
import type { NativeSleepBatch } from "@/types/sleep";

export interface SleepHealthStatus {
  status: "available" | "unavailable" | "update_required" | "web";
  granted: boolean;
}

interface SleepHealthConnectPlugin {
  getStatus(): Promise<SleepHealthStatus>;
  requestSleepPermission(): Promise<SleepHealthStatus>;
  openSettings(): Promise<void>;
  readSleep(options: { scopeId: string }): Promise<NativeSleepBatch>;
  acknowledge(options: { scopeId: string; nextToken: string }): Promise<void>;
  disconnect(options: { scopeId: string }): Promise<void>;
  exportData(options: { json: string }): Promise<{ saved: boolean }>;
}

const SleepHealthConnect = registerPlugin<SleepHealthConnectPlugin>("SleepHealthConnect");
const inFlight = new Map<string, Promise<number>>();

export const isSleepAndroid = () => Capacitor.getPlatform() === "android";

export async function sleepHealthStatus(): Promise<SleepHealthStatus> {
  if (!isSleepAndroid() || !Capacitor.isPluginAvailable("SleepHealthConnect")) return { status: "web", granted: false };
  return SleepHealthConnect.getStatus();
}

export const requestSleepPermission = () => SleepHealthConnect.requestSleepPermission();
export const openSleepHealthSettings = () => SleepHealthConnect.openSettings();

export async function clearSleepSync(uid: string, generation: string): Promise<void> {
  if (isSleepAndroid() && Capacitor.isPluginAvailable("SleepHealthConnect")) await SleepHealthConnect.disconnect({ scopeId: `${uid}:${generation}` });
}

export function syncSleep(uid: string, generation: string): Promise<number> {
  const scopeId = `${uid}:${generation}`;
  const existing = inFlight.get(scopeId);
  if (existing) return existing;
  const job = (async () => {
    let imported = 0;
    for (let page = 0; page < 100; page += 1) {
      if (auth.currentUser?.uid !== uid) throw new Error("A conta mudou. Abra novamente o controle de sono.");
      const batch = await SleepHealthConnect.readSleep({ scopeId });
      if (auth.currentUser?.uid !== uid) throw new Error("A conta mudou durante a sincronização.");
      const result = await importSleepBatch(generation, batch);
      if (auth.currentUser?.uid !== uid) throw new Error("A conta mudou durante a sincronização.");
      // Só avançar após confirmação do backend; replay é idempotente.
      await SleepHealthConnect.acknowledge({ scopeId, nextToken: batch.nextToken });
      imported += result.imported;
      if (!batch.hasMore) return imported;
    }
    throw new Error("Há muitos registros pendentes. Toque em sincronizar novamente para continuar.");
  })();
  inFlight.set(scopeId, job);
  void job.finally(() => inFlight.delete(scopeId)).catch(() => undefined);
  return job;
}

export async function exportSleepData(data: Record<string, unknown>): Promise<boolean> {
  const json = JSON.stringify(data, null, 2);
  if (isSleepAndroid() && Capacitor.isPluginAvailable("SleepHealthConnect")) return (await SleepHealthConnect.exportData({ json })).saved;
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "runnex-sono.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
