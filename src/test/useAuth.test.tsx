import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { User } from "firebase/auth";

let authStateCallback: ((user: User | null) => void) | null = null;
const onAuthStateChangedMock = vi.fn((_auth: unknown, callback: (user: User | null) => void) => {
  authStateCallback = callback;
  return vi.fn();
});

// O Firebase atualiza auth.currentUser antes de chamar onAuthStateChanged, e o
// AuthProvider relê auth.currentUser depois de sincronizar a foto do Google.
// O mock antigo deixava currentUser sempre null, então o user "sumia" logo
// depois do login no teste (e só no teste).
const mockAuth = vi.hoisted(() => ({ currentUser: null as User | null }));

vi.mock("@/config/firebase", () => ({
  auth: mockAuth,
  db: {},
}));

function fireAuthState(user: User | null) {
  mockAuth.currentUser = user;
  authStateCallback?.(user);
}

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (...args: [unknown, (user: User | null) => void]) => onAuthStateChangedMock(...args),
}));

vi.mock("@/lib/user-photo", () => ({
  syncGoogleProfilePhoto: vi.fn().mockResolvedValue(null),
}));

import { AuthProvider } from "@/hooks/AuthContext";
import { useAuth } from "@/hooks/useAuth";

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("useAuth / AuthProvider", () => {
  beforeEach(() => {
    authStateCallback = null;
    mockAuth.currentUser = null;
    onAuthStateChangedMock.mockClear();
  });

  it("lança erro quando usado fora do AuthProvider", () => {
    // React loga o erro de render no console mesmo quando é capturado abaixo;
    // silenciamos aqui só pra não poluir a saída do teste.
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
    consoleSpy.mockRestore();
  });

  it("começa com loading true e user null antes do Firebase responder", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it("atualiza para loading false com o usuário assim que onAuthStateChanged dispara", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    const fakeUser = { uid: "abc123", displayName: "Ana" } as User;
    act(() => {
      fireAuthState(fakeUser);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.user).toBe(fakeUser);
  });

  it("reflete logout (usuário null) sem travar loading em true", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      fireAuthState(null);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.user).toBeNull();
  });
});
