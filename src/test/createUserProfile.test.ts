import { describe, it, expect, vi, beforeEach } from "vitest";
import { createUserProfile } from "@/services/database";

// Regressão do bug crítico da auditoria: o cadastro por e-mail/senha não
// criava o perfil, então o primeiro ganho de XP virava uma criação com
// totalXP > 0 e era rejeitada pela validação do backend (que só aceita
// totalXP ausente/0 num perfil novo). createUserProfile foi escrita para
// nunca enviar totalXP/level — este teste garante que isso não regride
// silenciosamente após a migração para a API própria (Fase 1).

const { putMock } = vi.hoisted(() => ({
  putMock: vi.fn().mockResolvedValue({ uid: "user-123" }),
}));

// usersApi também lê o Firestore legado; sem este mock o import sobe o
// Firebase de verdade e quebra sem as variáveis VITE_FIREBASE_* (como no CI).
vi.mock("@/config/firebase", () => ({ auth: { currentUser: null }, db: {} }));

vi.mock("@/services/apiClient", () => ({
  api: { put: putMock, get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

describe("createUserProfile", () => {
  beforeEach(() => {
    putMock.mockClear();
  });

  it("nunca envia totalXP ou level no payload de criação", async () => {
    await createUserProfile("user-123", { displayName: "Ana", photoURL: null });

    expect(putMock).toHaveBeenCalledTimes(1);
    const [, payload] = putMock.mock.calls[0] as [string, Record<string, unknown>];

    expect(payload).not.toHaveProperty("totalXP");
    expect(payload).not.toHaveProperty("level");
  });

  it("envia termsVersion apenas quando o cadastro informa a versao dos termos", async () => {
    await createUserProfile("user-456", {
      displayName: "Bruno",
      photoURL: null,
      termsVersion: "2026-08-07",
    });
    const [, withTerms] = putMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(withTerms.termsVersion).toBe("2026-08-07");

    putMock.mockClear();
    await createUserProfile("user-789", { displayName: "Carla", photoURL: null });
    const [, withoutTerms] = putMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(withoutTerms.termsVersion).toBeUndefined();
  });
});
