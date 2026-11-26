import { beforeEach, describe, expect, it, vi } from "vitest";

// Com o servidor fora (o Render gratuito dorme), os serviços devolviam vazio
// (perfil null, estatísticas zeradas, nenhuma corrida, nenhum evento) em vez
// de avisar. As telas mostravam uma conta "zerada" e as telas de erro que já
// existem nunca apareciam. Agora a falha chega a quem chamou.

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/config/firebase", () => ({ auth: { currentUser: null }, db: {} }));
vi.mock("firebase/firestore", () => ({ doc: vi.fn(), getDoc: vi.fn().mockResolvedValue({ exists: () => false }), setDoc: vi.fn(), arrayUnion: vi.fn() }));
vi.mock("@/services/apiClient", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/services/apiClient")>();
  return { ...original, api: { ...original.api, get: mocks.get } };
});

import { ApiError } from "@/services/apiClient";
import { getUserProfile } from "@/services/usersApi";
import { getUserActivities, getUserStats } from "@/services/activitiesApi";
import { getEvents } from "@/services/eventsApi";

const offline = new ApiError(503, "Servidor indisponível");

describe("serviços avisam quando o servidor falha", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("perfil: erro do servidor chega a quem chamou", async () => {
    mocks.get.mockRejectedValue(offline);
    await expect(getUserProfile("ana")).rejects.toBe(offline);
  });

  it("perfil: 404 continua sendo 'ainda não tem perfil' (null)", async () => {
    mocks.get.mockRejectedValue(new ApiError(404, "Perfil nao encontrado."));
    await expect(getUserProfile("ana")).resolves.toBeNull();
  });

  it("estatísticas: erro chega a quem chamou, em vez de números zerados", async () => {
    mocks.get.mockRejectedValue(offline);
    await expect(getUserStats("ana")).rejects.toBe(offline);
  });

  it("histórico de corridas: erro chega a quem chamou, em vez de lista vazia", async () => {
    mocks.get.mockRejectedValue(offline);
    await expect(getUserActivities("ana", 20)).rejects.toBe(offline);
  });

  it("eventos: erro chega a quem chamou, em vez de lista vazia", async () => {
    mocks.get.mockRejectedValue(offline);
    await expect(getEvents("Campinas")).rejects.toBe(offline);
  });
});
