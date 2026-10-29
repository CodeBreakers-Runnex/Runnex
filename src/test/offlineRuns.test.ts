import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { currentUser: { uid: "ana" } as { uid: string } | null },
  saveActivity: vi.fn(),
  loadPlannedRun: vi.fn(),
  completePlannedRun: vi.fn(),
}));

vi.mock("@/config/firebase", () => ({ auth: mocks.auth }));
vi.mock("@/services/activitiesApi", () => ({ saveActivity: mocks.saveActivity }));
vi.mock("@/services/plannedRun", () => ({
  loadPlannedRun: mocks.loadPlannedRun,
  completePlannedRun: mocks.completePlannedRun,
}));

import { ApiError } from "@/services/apiClient";
import {
  enqueueRun,
  flushQueuedRuns,
  getQueuedRuns,
  isRetryableSaveError,
  newClientId,
  type QueuedRunPayload,
} from "@/services/offlineRuns";

function payload(clientId: string, distance = 5): QueuedRunPayload {
  return {
    userId: "ana", userName: "Ana", userAvatar: null, distance, time: "30:00", durationSeconds: 1800,
    pace: "6'00\"", type: "RUNNING", clientId, finishedAt: "2026-10-28T12:00:00.000Z",
  };
}

describe("fila offline das corridas", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.auth.currentUser = { uid: "ana" };
    mocks.saveActivity.mockReset();
    mocks.loadPlannedRun.mockReset();
    mocks.completePlannedRun.mockReset();
  });

  it("guarda por usuário e não repete o mesmo clientId", () => {
    expect(enqueueRun("ana", payload("a1"), null)).toBe(true);
    expect(enqueueRun("ana", payload("a1", 6), null)).toBe(true);
    expect(enqueueRun("bruno", payload("b1"), null)).toBe(true);
    expect(getQueuedRuns("ana").map((run) => run.payload.distance)).toEqual([6]);
    expect(getQueuedRuns("bruno")).toHaveLength(1);
  });

  it("envia em ordem, esvazia a fila e vincula o treino", async () => {
    enqueueRun("ana", payload("a1"), 42);
    enqueueRun("ana", payload("a2"), null);
    mocks.saveActivity.mockResolvedValueOnce({ id: "10", xpUpdateFailed: false }).mockResolvedValueOnce({ id: "11", xpUpdateFailed: false });
    mocks.loadPlannedRun.mockResolvedValue({ id: 42 });

    const result = await flushQueuedRuns("ana");

    expect(mocks.saveActivity.mock.calls.map(([sent]) => sent.clientId)).toEqual(["a1", "a2"]);
    expect(mocks.completePlannedRun).toHaveBeenCalledWith("ana", { id: 42 }, 10);
    expect(result.sent).toHaveLength(2);
    expect(result.remaining).toBe(0);
    expect(localStorage.getItem("runnex-offline-runs:ana")).toBeNull();
  });

  it("para no primeiro erro de rede e mantém o resto", async () => {
    enqueueRun("ana", payload("a1"), null);
    enqueueRun("ana", payload("a2"), null);
    mocks.saveActivity.mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await flushQueuedRuns("ana");

    expect(mocks.saveActivity).toHaveBeenCalledTimes(1);
    expect(result.remaining).toBe(2);
  });

  it("tira da fila a corrida recusada de vez e segue com as outras", async () => {
    enqueueRun("ana", payload("a1"), null);
    enqueueRun("ana", payload("a2"), null);
    mocks.saveActivity
      .mockRejectedValueOnce(new ApiError(422, "Velocidade acima de 30 km/h."))
      .mockResolvedValueOnce({ id: "11", xpUpdateFailed: false });

    const result = await flushQueuedRuns("ana");

    expect(result.rejected).toEqual([{ run: expect.objectContaining({ payload: expect.objectContaining({ clientId: "a1" }) }), reason: "Velocidade acima de 30 km/h." }]);
    expect(result.sent).toHaveLength(1);
    expect(result.remaining).toBe(0);
  });

  it("não envia corridas de outra conta logada", async () => {
    enqueueRun("ana", payload("a1"), null);
    mocks.auth.currentUser = { uid: "bruno" };
    const result = await flushQueuedRuns("ana");
    expect(mocks.saveActivity).not.toHaveBeenCalled();
    expect(result.remaining).toBe(1);
  });

  it("duas chamadas ao mesmo tempo enviam uma vez só", async () => {
    enqueueRun("ana", payload("a1"), null);
    mocks.saveActivity.mockResolvedValue({ id: "10", xpUpdateFailed: false });
    await Promise.all([flushQueuedRuns("ana"), flushQueuedRuns("ana")]);
    expect(mocks.saveActivity).toHaveBeenCalledTimes(1);
  });

  it("classifica os erros", () => {
    expect(isRetryableSaveError(new TypeError("Failed to fetch"))).toBe(true);
    for (const status of [401, 403, 408, 429, 500, 502, 503]) expect(isRetryableSaveError(new ApiError(status, ""))).toBe(true);
    for (const status of [400, 404, 422]) expect(isRetryableSaveError(new ApiError(status, ""))).toBe(false);
  });

  it("gera ids aceitos pelo backend", () => {
    const id = newClientId();
    expect(id).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(newClientId()).not.toBe(id);
  });
});
