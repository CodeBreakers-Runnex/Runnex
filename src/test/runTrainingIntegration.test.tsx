import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import RunTracking from "@/pages/app/RunTracking";
import { selectPlannedRun } from "@/lib/trainingRunSelection";

const mocks = vi.hoisted(() => ({ save: vi.fn(), load: vi.fn(), complete: vi.fn(), warn: vi.fn(), success: vi.fn(), navigate: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { uid: "ana", displayName: "Ana", providerData: [], photoURL: null } }) }));
vi.mock("@/config/firebase", () => ({ auth: { currentUser: { uid: "ana" } } }));
vi.mock("@/services/database", () => ({ saveActivity: (...args: unknown[]) => mocks.save(...args) }));
vi.mock("@/services/plannedRun", () => ({ loadPlannedRun: (...args: unknown[]) => mocks.load(...args), completePlannedRun: (...args: unknown[]) => mocks.complete(...args) }));
vi.mock("react-router-dom", async () => ({ ...await vi.importActual("react-router-dom"), useNavigate: () => mocks.navigate }));
vi.mock("@capacitor/core", () => ({ Capacitor: { getPlatform: () => "web" }, registerPlugin: () => ({}) }));
vi.mock("react-leaflet", () => ({ MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>, TileLayer: () => null, Polyline: () => null, Circle: () => null, useMap: () => ({ setView: () => undefined }) }));
vi.mock("sonner", () => ({ toast: { warning: (...args: unknown[]) => mocks.warn(...args), success: (...args: unknown[]) => mocks.success(...args), error: vi.fn(), info: vi.fn() } }));
const workout = { id: 5, revision: 2, title: "Treino planejado", category: "easy", status: "planned", targetDistanceKm: 5, targetDurationMinutes: 30 };
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  mocks.load.mockResolvedValue(workout); mocks.save.mockResolvedValue({ id: "77", xpUpdateFailed: false }); mocks.complete.mockResolvedValue(undefined);
  selectPlannedRun("ana", 5);
  localStorage.setItem("veloxy_active_run_v1", JSON.stringify({ userId: "ana", plannedWorkoutId: 5, distance: 1, seconds: 300, path: [[-23.55, -46.63], [-23.551, -46.631]], isSimulating: true, savedAt: Date.now() }));
});
afterEach(cleanup);

describe("corrida iniciada por treino", () => {
  const finish = async () => {
    render(<MemoryRouter><RunTracking /></MemoryRouter>);
    await screen.findByText("Treino planejado");
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    const finishButton = await screen.findByRole("button", { name: "Finalizar corrida" });
    await act(async () => { fireEvent.click(finishButton); });
  };
  it("restaura a seleção e salva a corrida antes de concluir o treino", async () => {
    await finish();
    await waitFor(() => expect(mocks.complete).toHaveBeenCalledWith("ana", workout, 77));
    expect(mocks.save.mock.invocationCallOrder[0]).toBeLessThan(mocks.complete.mock.invocationCallOrder[0]);
    expect(localStorage.getItem("veloxy_active_run_v1")).toBeNull();
    expect(localStorage.getItem("runnex_planned_run_v1")).toBeNull();
    expect(mocks.navigate).toHaveBeenCalledWith("/calendario-treinos");
  });
  it("preserva a corrida salva quando o vínculo falha", async () => {
    mocks.complete.mockRejectedValue(new Error("Sem conexão"));
    await finish();
    await waitFor(() => expect(mocks.warn).toHaveBeenCalledWith(expect.stringContaining("Corrida salva"), expect.anything()));
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith("/calendario-treinos");
  });
  it("falha ao salvar mantém o rascunho e não conclui o treino", async () => {
    mocks.save.mockRejectedValue(new Error("Falha no envio"));
    await finish();
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(localStorage.getItem("veloxy_active_run_v1")).not.toBeNull();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it("pausa a corrida e bloqueia a retomada enquanto salva", async () => {
    let resolve!: (result: { id: string; xpUpdateFailed: boolean }) => void;
    mocks.save.mockImplementation(() => new Promise(done => { resolve = done; }));
    await finish();
    const resume = screen.getByRole("button", { name: "Retomar corrida" });
    expect(resume).toBeDisabled();
    expect(JSON.parse(localStorage.getItem("veloxy_active_run_v1")!).seconds).toBe(300);
    await act(async () => { resolve({ id: "77", xpUpdateFailed: false }); });
  });
});
