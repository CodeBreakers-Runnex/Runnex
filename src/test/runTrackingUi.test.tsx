import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import type { RunningShoe } from "@/types";

// Fixa a parte visual da tela de corrida (seletor de tênis e aviso de
// corrida não finalizada) antes de separá-la em componentes.

const mocks = vi.hoisted(() => ({ shoes: vi.fn(), navigate: vi.fn(), info: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { uid: "ana", displayName: "Ana", providerData: [], photoURL: null } }) }));
vi.mock("@/config/firebase", () => ({ auth: { currentUser: { uid: "ana" } } }));
vi.mock("@/services/database", () => ({ saveActivity: vi.fn() }));
vi.mock("@/services/shoesApi", () => ({ getShoes: () => mocks.shoes() }));
vi.mock("@/services/plannedRun", () => ({ loadPlannedRun: vi.fn(), completePlannedRun: vi.fn() }));
vi.mock("react-router-dom", async () => ({ ...await vi.importActual("react-router-dom"), useNavigate: () => mocks.navigate }));
vi.mock("@capacitor/core", () => ({ Capacitor: { getPlatform: () => "web" }, registerPlugin: () => ({}) }));
vi.mock("react-leaflet", () => ({ MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>, TileLayer: () => null, Polyline: () => null, Circle: () => null, useMap: () => ({ setView: () => undefined }) }));
vi.mock("sonner", () => ({ toast: { warning: vi.fn(), success: vi.fn(), error: vi.fn(), info: (...a: unknown[]) => mocks.info(...a) } }));

import RunTracking from "@/pages/app/RunTracking";

const shoe = (id: string, extra: Partial<RunningShoe> = {}): RunningShoe => ({
  id, name: `Tênis ${id}`, brand: null, model: null, purchaseDate: null, initialKm: 0, limitKm: 600,
  isDefault: false, manuallyWorn: false, retired: false, totalKm: 100, remainingKm: 500, usagePercent: 16, runsCount: 3, status: "good", ...extra,
});

const renderRun = () => render(<MemoryRouter><RunTracking /></MemoryRouter>);
const select = () => screen.getByLabelText("Tênis") as HTMLSelectElement;

describe("tela de corrida: seletor de tênis e corrida não finalizada", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.shoes.mockReset().mockResolvedValue([shoe("1"), shoe("2", { isDefault: true }), shoe("3", { retired: true })]);
    mocks.navigate.mockReset();
    mocks.info.mockReset();
  });
  afterEach(cleanup);

  it("já vem com o tênis padrão e esconde os aposentados", async () => {
    renderRun();
    await waitFor(() => expect(select().value).toBe("2"));
    const names = Array.from(select().options).map((o) => o.textContent);
    expect(names).toEqual(["Sem tênis vinculado", "Tênis 1", "Tênis 2 (padrão)"]);
    expect(screen.getByText("100/600 km")).toBeInTheDocument();
  });

  it("troca o tênis e abre Meus tênis", async () => {
    renderRun();
    await waitFor(() => expect(select().value).toBe("2"));
    fireEvent.change(select(), { target: { value: "1" } });
    expect(select().value).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Meus tênis" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/tenis");
  });

  it("avisa sobre tênis gasto", async () => {
    mocks.shoes.mockResolvedValue([shoe("1", { isDefault: true, status: "worn" })]);
    renderRun();
    expect(await screen.findByText("Confira o desgaste deste tênis antes do treino.")).toBeInTheDocument();
  });

  it("se os tênis não carregarem, avisa e deixa correr sem vínculo", async () => {
    mocks.shoes.mockRejectedValue(new Error("offline"));
    renderRun();
    expect(await screen.findByText(/Não foi possível carregar os tênis/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar corrida" })).not.toBeDisabled();
  });

  it("corrida não finalizada: mostra a distância e pode ser descartada", async () => {
    localStorage.setItem("veloxy_active_run_v1", JSON.stringify({
      userId: "ana", distance: 2.5, seconds: 900, path: [[-23.55, -46.63], [-23.56, -46.64]], isSimulating: false, savedAt: Date.now(),
    }));
    renderRun();
    expect(await screen.findByText(/Encontramos 2.50 km de uma corrida/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    await waitFor(() => expect(screen.queryByText(/Encontramos 2.50 km/)).toBeNull());
    expect(localStorage.getItem("veloxy_active_run_v1")).toBeNull();
    expect(mocks.info).toHaveBeenCalledWith("Corrida descartada.");
  });
});
