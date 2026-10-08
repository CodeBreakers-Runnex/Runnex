import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import RunTracking from "@/pages/app/RunTracking";

const mocks = vi.hoisted(() => ({ uid: "ana", save: vi.fn(), shoes: vi.fn(), navigate: vi.fn(), warning: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { uid: mocks.uid, displayName: mocks.uid, providerData: [], photoURL: null } }) }));
vi.mock("@/config/firebase", () => ({ auth: { get currentUser() { return { uid: mocks.uid }; } } }));
vi.mock("@/services/database", () => ({ saveActivity: (...args: unknown[]) => mocks.save(...args) }));
vi.mock("@/services/shoesApi", () => ({ getShoes: () => mocks.shoes() }));
vi.mock("react-router-dom", async () => ({ ...await vi.importActual("react-router-dom"), useNavigate: () => mocks.navigate }));
vi.mock("@capacitor/core", () => ({ Capacitor: { getPlatform: () => "web" }, registerPlugin: () => ({}) }));
vi.mock("react-leaflet", () => ({ MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>, TileLayer: () => null, Polyline: () => null, Circle: () => null, useMap: () => ({ setView: () => undefined }) }));
vi.mock("sonner", () => ({ toast: { warning: (...args: unknown[]) => mocks.warning(...args), success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const key = "veloxy_active_run_v1";
const snapshot = { userId: "ana", shoeId: "9", distance: 1, seconds: 300, path: [[-23.55, -46.63], [-23.551, -46.631]], isSimulating: true, savedAt: Date.now() };
const tree = () => <MemoryRouter><RunTracking /></MemoryRouter>;
beforeEach(() => {
  vi.clearAllMocks(); mocks.uid = "ana"; localStorage.clear();
  mocks.shoes.mockResolvedValue([]); mocks.save.mockResolvedValue({ id: "77", xpUpdateFailed: false });
  localStorage.setItem(key, JSON.stringify(snapshot));
});
afterEach(cleanup);

describe("corrida com tênis e troca de conta", () => {
  it("restaura o tênis escolhido e salva uma única corrida", async () => {
    render(tree()); fireEvent.click(await screen.findByRole("button", { name: "Continuar" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Finalizar corrida" })); });
    expect(mocks.save).toHaveBeenCalledOnce();
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ userId: "ana", shoeId: "9" }));
    expect(localStorage.getItem(key)).toBeNull();
  });
  it("não oferece recuperação de rascunho antigo sem proprietário", async () => {
    localStorage.setItem(key, JSON.stringify({ ...snapshot, userId: undefined }));
    render(tree()); await waitFor(() => expect(mocks.shoes).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Continuar" })).toBeNull();
  });
  it("interrompe a corrida ao mudar de conta e preserva o dono do rascunho", async () => {
    const app = render(tree()); fireEvent.click(await screen.findByRole("button", { name: "Continuar" }));
    mocks.uid = "bia"; app.rerender(tree());
    await waitFor(() => expect(screen.queryByRole("button", { name: "Finalizar corrida" })).toBeNull());
    expect(JSON.parse(localStorage.getItem(key)!).userId).toBe("ana");
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("ignora a conclusão visual de uma gravação após trocar de conta", async () => {
    let finish!: (result: { id: string; xpUpdateFailed: boolean }) => void;
    mocks.save.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const app = render(tree()); fireEvent.click(await screen.findByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Finalizar corrida" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    mocks.uid = "bia"; app.rerender(tree());
    await act(async () => { finish({ id: "77", xpUpdateFailed: false }); });
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.warning).not.toHaveBeenCalled();
  });
});
