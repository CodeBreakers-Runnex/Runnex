import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { RecoveryOverview, SleepSession } from "@/types/sleep";

const mocks = vi.hoisted(() => ({
  getRecoveryOverview: vi.fn(), acceptSleepConsent: vi.fn(), createSleepSession: vi.fn(), updateSleepSession: vi.fn(), deleteSleepSession: vi.fn(), saveSleepCheckIn: vi.fn(), deleteSleepCheckIn: vi.fn(), updateRecoveryPreferences: vi.fn(), setSleepConnection: vi.fn(), deleteRecoveryData: vi.fn(), getSleepExport: vi.fn(),
  sleepHealthStatus: vi.fn(), syncSleep: vi.fn(), clearSleepSync: vi.fn(), requestSleepPermission: vi.fn(), openSleepHealthSettings: vi.fn(), exportSleepData: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { uid: "ana" } }) }));
vi.mock("@/services/recoveryApi", () => mocks);
vi.mock("@/services/sleepHealthConnect", () => mocks);

import Sleep from "@/pages/app/Sleep";
import { formatSleepMinutes } from "@/lib/sleep";

const record: SleepSession = { id: "1", source: "manual", origin: "runnex", originLabel: "Registro manual", externalId: null, sourceModifiedAt: null, startTime: "2026-10-07T22:00:00Z", endTime: "2026-10-08T06:00:00Z", wakeDate: "2026-10-08", endOffsetMinutes: 0, sleepSeconds: 7 * 3600, periodSeconds: 8 * 3600, kind: "main" };
function overview(consented = true): RecoveryOverview {
  const today = { date: "2026-10-08", mainSession: null, sleepMinutes: null, napCount: 0, checkIn: null, status: "insufficient" as const, signals: ["missing_sleep" as const], reasons: ["Não há registro de sono principal para este dia."] };
  return { settings: { goalMinutes: null, timezone: "UTC", preferredOrigin: null, consented, consentVersion: consented ? "sleep-v1-2026-10-08" : null, consentedAt: null, healthConnectEnabled: false, syncGeneration: "00000000-0000-0000-0000-000000000000", lastSyncedAt: null }, today, history: [today], sessions: [], origins: [], trend: { validDays: 0, requiredDays: 7, windowDays: 14, averageMinutes: null }, training: { currentKm: 5, currentMinutes: 30, previousKm: 0, previousMinutes: 0 }, algorithmVersion: "sleep-signals-v1" };
}
function renderPage() { return render(<MemoryRouter><Sleep /></MemoryRouter>); }

describe("controle de sono", () => {
  beforeEach(() => {
    for (const fn of Object.values(mocks)) fn.mockReset().mockResolvedValue(undefined);
    mocks.getRecoveryOverview.mockResolvedValue(overview());
    mocks.sleepHealthStatus.mockResolvedValue({ status: "web", granted: false });
  });

  it("pede aceite específico antes de habilitar formulários", async () => {
    mocks.getRecoveryOverview.mockResolvedValueOnce(overview(false)).mockResolvedValue(overview());
    renderPage();
    const activate = await screen.findByRole("button", { name: "Ativar controle de sono" });
    expect(activate).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Registrar sono" })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(activate);
    await waitFor(() => expect(mocks.acceptSleepConsent).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: "Registrar sono" })).toBeEnabled();
  });

  it("mostra ausência e caminho manual sem inventar duração", async () => {
    renderPage();
    expect(await screen.findByText("Nenhum sono registrado neste período. Registre seu primeiro sono para começar.")).toBeInTheDocument();
    expect(screen.getByText(/Aqui, use o registro manual/)).toBeInTheDocument();
    expect(screen.getAllByText("Dados insuficientes")).toHaveLength(2);
    expect(formatSleepMinutes(null)).toBe("Sem registro");
    expect(formatSleepMinutes(0)).toBe("0h00");
  });

  it("envia período, tempo informado e tipo para salvar um sono", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Registrar sono" }));
    fireEvent.change(screen.getByLabelText("Início do sono"), { target: { value: "2026-10-07T22:00" } });
    fireEvent.change(screen.getByLabelText("Fim do sono"), { target: { value: "2026-10-08T06:00" } });
    fireEvent.change(screen.getByLabelText(/Tempo dormido/), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar sono" }));
    await waitFor(() => expect(mocks.createSleepSession).toHaveBeenCalledWith(expect.objectContaining({ sleepSeconds: 25200, kind: "main" })));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("rejeita estimativa superior ao período antes de enviar", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Registrar sono" }));
    fireEvent.change(screen.getByLabelText("Início do sono"), { target: { value: "2026-10-07T22:00" } });
    fireEvent.change(screen.getByLabelText("Fim do sono"), { target: { value: "2026-10-08T06:00" } });
    fireEvent.change(screen.getByLabelText(/Tempo dormido/), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar sono" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("O tempo dormido deve caber dentro do período registrado.");
    expect(mocks.createSleepSession).not.toHaveBeenCalled();
  });

  it("edita somente registro manual e permite corrigir duração", async () => {
    mocks.getRecoveryOverview.mockResolvedValue({ ...overview(), sessions: [record] });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Editar sono 1" }));
    fireEvent.change(screen.getByLabelText(/Tempo dormido/), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar sono" }));
    await waitFor(() => expect(mocks.updateSleepSession).toHaveBeenCalledWith("1", expect.objectContaining({ sleepSeconds: 21600 })));
  });

  it("salva cansaço sem exigir resposta de qualidade", async () => {
    renderPage();
    fireEvent.change(await screen.findByLabelText("Como está seu cansaço?"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar check-in" }));
    await waitFor(() => expect(mocks.saveSleepCheckIn).toHaveBeenCalledWith("2026-10-08", { quality: null, fatigue: 4 }));
  });

  it("busca histórico de 30 dias ao mudar o período", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "30 dias" }));
    await waitFor(() => expect(mocks.getRecoveryOverview).toHaveBeenCalledWith(30));
  });

  it("confirma exclusão geral e retira autorização", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Apagar dados e retirar autorização" }));
    expect(mocks.deleteRecoveryData).not.toHaveBeenCalled();
    mocks.getRecoveryOverview.mockResolvedValue(overview(false));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar exclusão dos dados de sono" }));
    await waitFor(() => expect(mocks.deleteRecoveryData).toHaveBeenCalledOnce());
    expect(await screen.findByRole("button", { name: "Ativar controle de sono" })).toBeInTheDocument();
  });

  it("permite recuperar de erro no carregamento", async () => {
    mocks.getRecoveryOverview.mockRejectedValueOnce(new Error("Servidor indisponível"));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Servidor indisponível");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("button", { name: "Registrar sono" })).toBeInTheDocument();
  });
});
