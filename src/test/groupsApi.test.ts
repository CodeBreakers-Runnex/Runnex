import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RunningGroup } from "@/types";

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  setDoc: vi.fn(),
  socketHandlers: [] as Array<(event: { type: string; postId?: string }) => void>,
  unsubscribeSocket: vi.fn(),
}));

vi.mock("@/config/firebase", () => ({ auth: { currentUser: null }, db: {} }));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...path: string[]) => path.join("/"),
  setDoc: mocks.setDoc,
  arrayUnion: (value: string) => ({ arrayUnion: value }),
  arrayRemove: (value: string) => ({ arrayRemove: value }),
}));
vi.mock("@/services/apiClient", async () => {
  const actual = await vi.importActual<typeof import("@/services/apiClient")>("@/services/apiClient");
  return { ...actual, api: mocks.api };
});
vi.mock("@/services/groupSocket", () => ({
  subscribeToGroupEvents: (_groupId: string, handler: (event: { type: string; postId?: string }) => void) => {
    mocks.socketHandlers.push(handler);
    return mocks.unsubscribeSocket;
  },
}));

import { ApiError } from "@/services/apiClient";
import {
  getGroupById,
  getGroupLeaderboard,
  getGroups,
  joinGroup,
  leaveGroup,
  subscribeToGroupMessages,
  subscribeToGroupPostComments,
  subscribeToGroupPosts,
} from "@/services/groupsApi";

const realGroup = { id: "42", name: "Real", memberIds: ["ana"] } as RunningGroup;

function emit(event: { type: string; postId?: string }) {
  mocks.socketHandlers.forEach((handler) => handler(event));
}

describe("groupsApi", () => {
  beforeEach(() => {
    Object.values(mocks.api).forEach((fn) => fn.mockReset());
    mocks.setDoc.mockReset();
    mocks.unsubscribeSocket.mockReset();
    mocks.socketHandlers.length = 0;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("getGroups", () => {
    it("usa os grupos reais quando existem", async () => {
      mocks.api.get.mockResolvedValue([realGroup]);
      await expect(getGroups()).resolves.toEqual([realGroup]);
    });

    it("sem nenhum grupo real, mostra os grupos de demonstração", async () => {
      mocks.api.get.mockResolvedValueOnce([]);
      const empty = await getGroups();
      expect(empty.map((g) => g.id)).toContain("sp-runners");
    });

    // Antes a falha também caía nos grupos de demonstração: com o servidor
    // fora, a pessoa via "128 membros" inventados no lugar dos grupos dela.
    it("se a API falhar, avisa quem chamou em vez de mostrar grupos inventados", async () => {
      const offline = new Error("offline");
      mocks.api.get.mockRejectedValueOnce(offline);
      await expect(getGroups()).rejects.toBe(offline);
    });
  });

  describe("join/leave", () => {
    it("grupo real vai para a API", async () => {
      await joinGroup("42", "ana");
      await leaveGroup("42", "ana");
      expect(mocks.api.post.mock.calls.map(([path]) => path)).toEqual(["/groups/42/join", "/groups/42/leave"]);
      expect(mocks.setDoc).not.toHaveBeenCalled();
    });

    it("grupo de demonstração grava no Firestore legado, não na API", async () => {
      await joinGroup("sp-runners", "ana");
      expect(mocks.setDoc).toHaveBeenCalledWith("users/ana", { joinedGroupIds: { arrayUnion: "sp-runners" } }, { merge: true });
      expect(mocks.api.post).not.toHaveBeenCalled();
    });
  });

  describe("getGroupById", () => {
    it("resolve grupo de demonstração sem chamar a API", async () => {
      expect((await getGroupById("5k-iniciantes"))?.name).toBe("5K Iniciantes");
      expect(mocks.api.get).not.toHaveBeenCalled();
    });

    it("404 vira null; outros erros sobem", async () => {
      mocks.api.get.mockRejectedValueOnce(new ApiError(404, "Grupo nao encontrado."));
      await expect(getGroupById("99")).resolves.toBeNull();

      mocks.api.get.mockRejectedValueOnce(new ApiError(403, "Voce precisa ser membro do grupo."));
      await expect(getGroupById("99")).rejects.toMatchObject({ status: 403 });
    });
  });

  it("ranking do grupo ordena por XP e consulta no máximo 30 membros", async () => {
    const memberIds = Array.from({ length: 40 }, (_, i) => `u${i}`);
    mocks.api.get.mockResolvedValue([
      { uid: "u1", totalXP: 100 },
      { uid: "u2", totalXP: 900 },
      { uid: "u3" },
    ]);

    const ranking = await getGroupLeaderboard({ ...realGroup, memberIds });

    expect(ranking.map((u) => u.uid)).toEqual(["u2", "u1", "u3"]);
    const [path] = mocks.api.get.mock.calls[0];
    expect(path.split("ids=")[1].split(",")).toHaveLength(30);
  });

  it("comentários: busca de novo só para eventos do mesmo post e para ao cancelar", async () => {
    vi.useFakeTimers();
    mocks.api.get.mockResolvedValue([]);
    const callback = vi.fn();

    const unsubscribe = subscribeToGroupPostComments("42", "7", callback);
    await vi.waitFor(() => expect(callback).toHaveBeenCalledTimes(1));

    emit({ type: "comment_created", postId: "8" });
    emit({ type: "message_created" });
    expect(mocks.api.get).toHaveBeenCalledTimes(1);

    emit({ type: "comment_created", postId: "7" });
    await vi.waitFor(() => expect(callback).toHaveBeenCalledTimes(2));

    unsubscribe();
    expect(mocks.unsubscribeSocket).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(mocks.api.get).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  describe("falha ao buscar posts, comentários e chat", () => {
    // Sem aviso de erro, a tela ficava com o carregando girando até o
    // polling de 60 s tentar de novo.
    it.each([
      ["posts", (onData: () => void, onError: (e: unknown) => void) => subscribeToGroupPosts("42", onData, 30, onError)],
      ["comentários", (onData: () => void, onError: (e: unknown) => void) => subscribeToGroupPostComments("42", "7", onData, onError)],
      ["chat", (onData: () => void, onError: (e: unknown) => void) => subscribeToGroupMessages("42", onData, 100, onError)],
    ])("%s: avisa quem assinou", async (_name, subscribe) => {
      const offline = new Error("offline");
      mocks.api.get.mockRejectedValue(offline);
      const onData = vi.fn();
      const onError = vi.fn();
      const unsubscribe = subscribe(onData, onError);
      await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(offline));
      expect(onData).not.toHaveBeenCalled();
      unsubscribe();
    });

    it("depois de cancelar, não avisa mais", async () => {
      let reject: (e: unknown) => void = () => undefined;
      mocks.api.get.mockReturnValue(new Promise((_, r) => { reject = r; }));
      const onError = vi.fn();
      const unsubscribe = subscribeToGroupMessages("42", vi.fn(), 100, onError);
      unsubscribe();
      reject(new Error("offline"));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(onError).not.toHaveBeenCalled();
    });
  });
});
