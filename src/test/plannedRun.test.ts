import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearPlannedRun, getPlannedRun, selectPlannedRun } from "@/lib/trainingRunSelection";
import { completePlannedRun, loadPlannedRun } from "@/services/plannedRun";
import type { Workout } from "@/types/training";

const mocks = vi.hoisted(() => ({ account: { currentUser: { uid: "ana" } as { uid: string } | null }, get: vi.fn(), link: vi.fn() }));
vi.mock("@/config/firebase", () => ({ auth: mocks.account }));
vi.mock("@/services/trainingApi", () => ({ getWorkout: (...args: unknown[]) => mocks.get(...args), linkWorkoutActivity: (...args: unknown[]) => mocks.link(...args) }));
const w = { id: 5, revision: 3, category: "easy", status: "planned" } as Workout;
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mocks.account.currentUser = { uid: "ana" }; mocks.get.mockResolvedValue(w); mocks.link.mockResolvedValue(w); });

describe("seleção privada e vínculo de treino", () => {
  it("recupera a seleção apenas para o proprietário", () => { selectPlannedRun("ana", 5); expect(getPlannedRun("ana")?.workoutId).toBe(5); expect(getPlannedRun("bruno")).toBeNull(); clearPlannedRun("bruno"); expect(getPlannedRun("ana")?.workoutId).toBe(5); });
  it("tolera armazenamento corrompido", () => { localStorage.setItem("runnex_planned_run_v1", "inválido"); expect(getPlannedRun("ana")).toBeNull(); });
  it("revalida o treino no servidor", async () => { await expect(loadPlannedRun("ana", 5)).resolves.toBe(w); expect(mocks.get).toHaveBeenCalledWith(5); });
  it("bloqueia descanso e treino já concluído", async () => { mocks.get.mockResolvedValueOnce({ ...w, category: "rest" }).mockResolvedValueOnce({ ...w, status: "completed" }); await expect(loadPlannedRun("ana", 5)).rejects.toThrow("não está disponível"); await expect(loadPlannedRun("ana", 5)).rejects.toThrow("não está disponível"); });
  it("descarta resposta recebida após troca de conta", async () => { mocks.get.mockImplementation(async () => { mocks.account.currentUser = { uid: "bruno" }; return w; }); await expect(loadPlannedRun("ana", 5)).rejects.toThrow("A conta mudou"); });
  it("vincula somente o ID real retornado após salvar a corrida", async () => { await completePlannedRun("ana", w, 20); expect(mocks.link).toHaveBeenCalledWith(w, 20); });
  it("propaga falha de vínculo para permitir tentativa pela agenda", async () => { mocks.link.mockRejectedValue(new Error("Sem conexão")); await expect(completePlannedRun("ana", w, 20)).rejects.toThrow("Sem conexão"); });
  it("impede vínculo iniciado na conta diferente", async () => { mocks.account.currentUser = { uid: "bruno" }; await expect(completePlannedRun("ana", w, 20)).rejects.toThrow("A conta mudou"); expect(mocks.link).not.toHaveBeenCalled(); });
});
