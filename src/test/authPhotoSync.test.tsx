import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";

// Ao abrir o app, o AuthProvider leva a foto do Firebase Auth (para conta
// Google, a foto do Google) para o perfil no backend. Uma foto escolhida no
// Perfil fica só no backend (base64, o Firebase Auth não aceita), então essa
// sincronização não pode passar por cima dela.

const GOOGLE_PHOTO = "https://lh3.googleusercontent.com/a/foto-google";
const CUSTOM_PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

let authStateCallback: ((user: User | null) => void) | null = null;
const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as User | null },
  createUserProfile: vi.fn(),
  apiGet: vi.fn(),
}));

vi.mock("@/config/firebase", () => ({ auth: mocks.auth, db: {} }));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: User | null) => void) => {
    authStateCallback = callback;
    return vi.fn();
  },
}));
vi.mock("@/lib/user-photo", () => ({ syncGoogleProfilePhoto: vi.fn().mockResolvedValue(null) }));
vi.mock("@/services/database", () => ({ createUserProfile: mocks.createUserProfile }));
vi.mock("@/services/apiClient", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/services/apiClient")>();
  return { ...original, api: { ...original.api, get: mocks.apiGet } };
});

import { AuthProvider } from "@/hooks/AuthContext";
import { ApiError } from "@/services/apiClient";

const googleUser = { uid: "ana", displayName: "Ana", photoURL: GOOGLE_PHOTO } as User;

async function openApp() {
  render(<AuthProvider><div /></AuthProvider>);
  act(() => {
    mocks.auth.currentUser = googleUser;
    authStateCallback?.(googleUser);
  });
  // Deixa a cadeia de promessas da sincronização terminar antes de conferir.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

describe("sincronização da foto ao abrir o app", () => {
  beforeEach(() => {
    authStateCallback = null;
    mocks.auth.currentUser = null;
    mocks.createUserProfile.mockReset().mockResolvedValue(undefined);
    mocks.apiGet.mockReset();
  });

  it("não troca a foto escolhida no Perfil pela foto do Google", async () => {
    mocks.apiGet.mockResolvedValue({ uid: "ana", photoURL: CUSTOM_PHOTO });
    await openApp();
    expect(mocks.createUserProfile).not.toHaveBeenCalled();
  });

  it("perfil sem foto recebe a foto do Google", async () => {
    mocks.apiGet.mockResolvedValue({ uid: "ana", photoURL: null });
    await openApp();
    await waitFor(() => expect(mocks.createUserProfile).toHaveBeenCalledWith("ana", { photoURL: GOOGLE_PHOTO }));
  });

  it("foto do Google trocada no Google chega ao perfil", async () => {
    mocks.apiGet.mockResolvedValue({ uid: "ana", photoURL: "https://lh3.googleusercontent.com/a/foto-antiga" });
    await openApp();
    await waitFor(() => expect(mocks.createUserProfile).toHaveBeenCalledWith("ana", { photoURL: GOOGLE_PHOTO }));
  });

  it("não regrava quando o perfil já tem a mesma foto", async () => {
    mocks.apiGet.mockResolvedValue({ uid: "ana", photoURL: GOOGLE_PHOTO });
    await openApp();
    expect(mocks.createUserProfile).not.toHaveBeenCalled();
  });

  it("sem perfil no backend (primeiro login), continua criando com a foto", async () => {
    mocks.apiGet.mockRejectedValue(new ApiError(404, "Perfil nao encontrado."));
    await openApp();
    await waitFor(() => expect(mocks.createUserProfile).toHaveBeenCalledWith("ana", { photoURL: GOOGLE_PHOTO }));
  });
});
