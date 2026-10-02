import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  createUserProfile: vi.fn(),
  signOut: vi.fn(),
  user: { uid: "ana", displayName: "Ana", photoURL: "https://x/a.png" },
}));

vi.mock("@/config/firebase", () => ({ auth: {}, db: {} }));
vi.mock("firebase/auth", () => ({ signOut: mocks.signOut }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user, loading: false }) }));
vi.mock("@/services/database", () => ({ createUserProfile: mocks.createUserProfile }));
vi.mock("@/services/apiClient", async () => {
  const actual = await vi.importActual<typeof import("@/services/apiClient")>("@/services/apiClient");
  return { ...actual, api: { get: mocks.get } };
});

import TermsGate from "@/components/TermsGate";
import { LEGAL_VERSION } from "@/content/legalContent";
import { ApiError } from "@/services/apiClient";

function renderGate() {
  return render(<MemoryRouter><TermsGate /></MemoryRouter>);
}

describe("TermsGate", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.createUserProfile.mockReset().mockResolvedValue(undefined);
  });

  it("não aparece para quem já aceitou a versão atual", async () => {
    mocks.get.mockResolvedValue({ termsVersion: LEGAL_VERSION });
    renderGate();
    await waitFor(() => expect(mocks.get).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("pede aceite a quem nunca aceitou (ex.: login com Google)", async () => {
    mocks.get.mockResolvedValue({ termsVersion: null });
    renderGate();
    expect(await screen.findByText("Antes de continuar")).toBeInTheDocument();
  });

  it("pede novo aceite a quem aceitou uma versão antiga", async () => {
    mocks.get.mockResolvedValue({ termsVersion: "2026-08-07" });
    renderGate();
    expect(await screen.findByText("Atualizamos nossos termos")).toBeInTheDocument();
  });

  it("aceitar grava a versão atual e fecha", async () => {
    mocks.get.mockResolvedValue({ termsVersion: "2026-08-07" });
    renderGate();
    const accept = await screen.findByRole("button", { name: /aceitar/i });
    expect(accept).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(accept);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.createUserProfile).toHaveBeenCalledWith("ana", { termsVersion: LEGAL_VERSION });
  });

  it("sem perfil no backend, o aceite também cria o perfil com nome e foto", async () => {
    mocks.get.mockRejectedValue(new ApiError(404, "Perfil nao encontrado."));
    renderGate();
    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /aceitar/i }));

    await waitFor(() =>
      expect(mocks.createUserProfile).toHaveBeenCalledWith("ana", {
        termsVersion: LEGAL_VERSION,
        displayName: "Ana",
        photoURL: "https://x/a.png",
      }),
    );
  });

  it("backend fora do ar não bloqueia o app", async () => {
    mocks.get.mockRejectedValue(new ApiError(503, "Servidor indisponivel"));
    renderGate();
    await waitFor(() => expect(mocks.get).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
