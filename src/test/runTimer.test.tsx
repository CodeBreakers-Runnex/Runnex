import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

// Cronômetro da corrida. Ele contava tiques de setInterval (+1 s por tique).
// Com a tela bloqueada, o WebView pode atrasar ou pular tiques enquanto o GPS
// nativo continua somando distância: o tempo saía menor que o real, o ritmo
// errado e, no limite, a velocidade média passava de 30 km/h e o servidor
// recusava a corrida. Agora o tempo vem do relógio.

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { uid: "ana", displayName: "Ana", providerData: [], photoURL: null } }) }));
vi.mock("@/config/firebase", () => ({ auth: { currentUser: { uid: "ana" } } }));
vi.mock("@/services/database", () => ({ saveActivity: vi.fn() }));
vi.mock("@/services/shoesApi", () => ({ getShoes: () => Promise.resolve([]) }));
vi.mock("@/services/plannedRun", () => ({ loadPlannedRun: vi.fn(), completePlannedRun: vi.fn() }));
vi.mock("react-router-dom", async () => ({ ...await vi.importActual("react-router-dom"), useNavigate: () => mocks.navigate }));
vi.mock("@capacitor/core", () => ({ Capacitor: { getPlatform: () => "web" }, registerPlugin: () => ({}) }));
vi.mock("react-leaflet", () => ({ MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>, TileLayer: () => null, Polyline: () => null, Circle: () => null, useMap: () => ({ setView: () => undefined }) }));
vi.mock("sonner", () => ({ toast: { warning: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import RunTracking from "@/pages/app/RunTracking";

async function startRun() {
  render(<MemoryRouter><RunTracking /></MemoryRouter>);
  const start = await screen.findByRole("button", { name: "Iniciar corrida" });
  await waitFor(() => expect(start).not.toBeDisabled());
  vi.useFakeTimers();
  fireEvent.click(start);
}

describe("cronômetro da corrida", () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { vi.useRealTimers(); cleanup(); });

  it("conta os segundos normalmente", async () => {
    await startRun();
    await act(async () => { vi.advanceTimersByTime(5_000); });
    expect(screen.getAllByText("00:05").length).toBeGreaterThan(0);
  });

  it("com tiques atrasados (tela bloqueada), mostra o tempo real e não o número de tiques", async () => {
    await startRun();
    // 10 minutos passam no relógio, mas o WebView só deixou rodar um tique.
    vi.setSystemTime(Date.now() + 600_000);
    await act(async () => { vi.advanceTimersByTime(1_000); });
    expect(screen.getAllByText("10:01").length).toBeGreaterThan(0);
  });

  it("tempo pausado não conta", async () => {
    await startRun();
    await act(async () => { vi.advanceTimersByTime(3_000); });
    fireEvent.click(screen.getByRole("button", { name: "Pausar corrida" }));
    vi.setSystemTime(Date.now() + 120_000);
    await act(async () => { vi.advanceTimersByTime(120_000); });
    expect(screen.getAllByText("00:03").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Retomar corrida" }));
    await act(async () => { vi.advanceTimersByTime(2_000); });
    expect(screen.getAllByText("00:05").length).toBeGreaterThan(0);
  });

  it("velocidade não mostra infinito antes do primeiro segundo", async () => {
    await startRun();
    expect(screen.queryByText("Infinity")).toBeNull();
    expect(screen.queryByText("NaN")).toBeNull();
  });
});
