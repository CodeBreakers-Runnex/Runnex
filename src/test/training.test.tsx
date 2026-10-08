import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TrainingCalendar from "@/pages/app/TrainingCalendar";
import { dayKey, weekStart } from "@/lib/training";
import type { TrainingSummary, Workout } from "@/types/training";

const mocks = vi.hoisted(() => ({ uid: "ana", get: vi.fn(), summary: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), status: vi.fn(), link: vi.fn(), activities: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { uid: mocks.uid } }) }));
vi.mock("@/services/database", () => ({ getUserActivities: (...args: unknown[]) => mocks.activities(...args) }));
vi.mock("@/services/trainingApi", () => ({ getWorkouts: (...args: unknown[]) => mocks.get(...args), getTrainingSummary: (...args: unknown[]) => mocks.summary(...args), createWorkout: (...args: unknown[]) => mocks.create(...args), updateWorkout: (...args: unknown[]) => mocks.update(...args), deleteWorkout: (...args: unknown[]) => mocks.remove(...args), setWorkoutStatus: (...args: unknown[]) => mocks.status(...args), linkWorkoutActivity: (...args: unknown[]) => mocks.link(...args) }));
const today = dayKey(new Date());
const workout = (extra: Partial<Workout> = {}): Workout => ({ id: 1, title: "Leve 5 km", category: "easy", plannedDate: today, plannedTime: null, timezone: "America/Sao_Paulo", notes: "", targetDistanceKm: 5, targetDurationMinutes: 30, status: "planned", completionSource: null, completedAt: null, completedActivityId: null, scheduledAt: null, originalDate: today, evidenceRemoved: false, revision: 1, overdue: false, activity: null, ...extra });
const summary: TrainingSummary = { week: weekStart(today), end: today, timezone: "America/Sao_Paulo", plannedCount: 1, completedCount: 0, manualCount: 0, skippedCount: 0, restCount: 0, targetKm: 5, targetMinutes: 30, recordedKm: 0, recordedMinutes: 0, runCount: 0, closed: false, completionRate: null };
const mount = () => render(<MemoryRouter><TrainingCalendar /></MemoryRouter>);
beforeEach(() => {
  vi.clearAllMocks(); mocks.uid = "ana";
  mocks.get.mockResolvedValue([workout()]); mocks.summary.mockResolvedValue(summary); mocks.activities.mockResolvedValue([]);
  mocks.create.mockResolvedValue(workout({ id: 2 })); mocks.update.mockResolvedValue(workout({ revision: 2 })); mocks.remove.mockResolvedValue(undefined);
  mocks.status.mockResolvedValue(workout({ status: "completed", completionSource: "manual", revision: 2 })); mocks.link.mockResolvedValue(workout());
});
afterEach(cleanup);

describe("calendário de treinos", () => {
  it("alterna mês, semana e agenda sem deslocar o dia", async () => {
    mount(); await screen.findByText("Leve 5 km");
    const monthRange = mocks.get.mock.calls[0];
    fireEvent.click(screen.getByRole("button", { name: "Semana" }));
    await waitFor(() => expect(mocks.get.mock.calls.at(-1)?.[0]).toBe(weekStart(today)));
    expect(mocks.get.mock.calls.at(-1)).not.toEqual(monthRange);
    fireEvent.click(screen.getByRole("button", { name: "Lista" }));
    await screen.findByText("Agenda do mês");
    expect(screen.getByText("Leve 5 km")).toBeInTheDocument();
  });
  it("envia metas opcionais ausentes como null", async () => {
    mount(); await screen.findByText("Leve 5 km");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar treino" }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "  Livre amanhã  " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar treino" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ title: "Livre amanhã", targetDistanceKm: null, targetDurationMinutes: null, plannedTime: null, plannedDate: today })));
  });
  it("descanso remove metas já digitadas", async () => {
    mount(); await screen.findByText("Leve 5 km");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar treino" }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Descanso" } });
    fireEvent.change(screen.getByLabelText("Meta (km)"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Categoria"), { target: { value: "rest" } });
    expect(screen.queryByLabelText("Meta (km)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salvar treino" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ category: "rest", targetDistanceKm: null })));
  });
  it("reagenda o registro existente com a revisão carregada", async () => {
    mount(); fireEvent.click(await screen.findByText("Leve 5 km"));
    fireEvent.click(screen.getByRole("button", { name: "Editar / reagendar" }));
    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-12-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar treino" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ id: 1, revision: 1 }), expect.objectContaining({ plannedDate: "2026-12-10", targetDistanceKm: 5 })));
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("conclui manualmente pela rota de agenda", async () => {
    mount(); fireEvent.click(await screen.findByText("Leve 5 km"));
    fireEvent.click(screen.getByRole("button", { name: "Concluir manualmente" }));
    await waitFor(() => expect(mocks.status).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), "completed"));
  });
  it("compara resultado real menor que a meta e identifica evidência", async () => {
    mocks.get.mockResolvedValue([workout({ status: "completed", completionSource: "activity", activity: { id: 11, distance: 4.7, durationSeconds: 1500, pace: "5'19\"", recordedAt: new Date().toISOString() } })]);
    mount(); fireEvent.click(await screen.findByText("Leve 5 km"));
    expect(screen.getByText("Diferença de distância: -0.30 km")).toBeInTheDocument();
    expect(screen.getByText("Diferença de duração: -5.0 min")).toBeInTheDocument();
    expect(screen.getByText("Corrida registrada")).toBeInTheDocument();
  });
  it("pede confirmação antes de excluir o planejamento", async () => {
    mount(); fireEvent.click(await screen.findByText("Leve 5 km"));
    fireEvent.click(screen.getByRole("button", { name: "Excluir planejamento" }));
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(screen.getByText(/A corrida registrada será preservada/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar exclusão" }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(expect.objectContaining({ id: 1, revision: 1 })));
  });
  it("mantém mensagem da falha de atualização no diálogo", async () => {
    mocks.status.mockRejectedValue(new Error("Recarregue a agenda e tente novamente."));
    mount(); fireEvent.click(await screen.findByText("Leve 5 km"));
    fireEvent.click(screen.getByRole("button", { name: "Concluir manualmente" }));
    await waitFor(() => expect(within(screen.getByRole("dialog")).getByRole("alert")).toHaveTextContent("Recarregue a agenda"));
  });
  it("permite tentar novamente após erro de carregamento", async () => {
    mocks.get.mockRejectedValueOnce(new Error("Sem conexão"));
    mount(); await screen.findByText("Sem conexão");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByText("Leve 5 km");
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });
  it("fecha o formulário privado ao trocar de conta", async () => {
    const app = mount(); fireEvent.click(await screen.findByText("Leve 5 km"));
    fireEvent.click(screen.getByRole("button", { name: "Editar / reagendar" }));
    fireEvent.change(screen.getByLabelText("Observações"), { target: { value: "Privado da Ana" } });
    mocks.uid = "bruno"; mocks.get.mockResolvedValue([]);
    app.rerender(<MemoryRouter><TrainingCalendar /></MemoryRouter>);
    expect(screen.queryByDisplayValue("Privado da Ana")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
