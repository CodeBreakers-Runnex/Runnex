import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Compra de RunCoins: o servidor decide se existe (mockPurchases). Desligada,
// o Pet não oferece loja nenhuma (nem botão "+", nem "Comprar" no aviso de
// saldo curto); ligada, tudo funciona como antes.

const mocks = vi.hoisted(() => ({
  auth: { user: { uid: "ana", displayName: "Ana", photoURL: null, providerData: [] } },
  getUserProfile: vi.fn(),
  getUserStats: vi.fn(),
  getCoinPacks: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/config/firebase", () => ({ auth: {}, db: {} }));
vi.mock("@/services/database", () => ({
  getUserProfile: (...a: unknown[]) => mocks.getUserProfile(...a),
  getUserStats: (...a: unknown[]) => mocks.getUserStats(...a),
  choosePet: vi.fn(),
  equipPetAccessory: vi.fn(),
  purchasePetAccessory: vi.fn(),
}));
vi.mock("@/services/coinsApi", () => ({
  getCoinPacks: (...a: unknown[]) => mocks.getCoinPacks(...a),
  mockPurchaseCoins: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

import Pet from "@/pages/app/Pet";

const profile = { uid: "ana", petSpecies: "cachorro", petName: "Rex", petCoins: 5, totalXP: 0, petUnlockedAccessoryIds: [] };

const renderPet = async () => {
  render(<MemoryRouter><Pet /></MemoryRouter>);
  await screen.findAllByText("Rex");
};

describe("loja de RunCoins no Pet", () => {
  beforeEach(() => {
    mocks.getUserProfile.mockReset().mockResolvedValue(profile);
    mocks.getUserStats.mockReset().mockResolvedValue({ currentStreak: 0 });
    mocks.getCoinPacks.mockReset();
    mocks.toastError.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("com compras habilitadas pelo servidor, o botão abre a loja", async () => {
    mocks.getCoinPacks.mockResolvedValue({ packs: [], mockPurchases: true });
    await renderPet();
    const buy = await screen.findByRole("button", { name: "Comprar RunCoins" });
    fireEvent.click(buy);
    expect(await screen.findByRole("dialog", { name: "Comprar RunCoins" })).toBeTruthy();
  });

  it("com compras desligadas, mostra o saldo sem botão de comprar", async () => {
    mocks.getCoinPacks.mockResolvedValue({ packs: [], mockPurchases: false });
    await renderPet();
    await waitFor(() => expect(mocks.getCoinPacks).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Comprar RunCoins" })).toBeNull();
    expect(screen.getByLabelText("Saldo de RunCoins").textContent).toContain("5");
  });

  it("se o servidor não responder, trata como desligado", async () => {
    mocks.getCoinPacks.mockRejectedValue(new Error("offline"));
    await renderPet();
    await waitFor(() => expect(mocks.getCoinPacks).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Comprar RunCoins" })).toBeNull();
    expect(screen.getByLabelText("Saldo de RunCoins")).toBeTruthy();
  });
});
