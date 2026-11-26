import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { GroupMessage, GroupPost, RunningGroup } from "@/types";

// Feed, chat e comentários do grupo: se a primeira busca falhar, a tela
// mostra o erro com "tentar de novo" em vez de ficar com o carregando
// girando. E curtir um post que não salvou passa a avisar.

type Sub<T> = { onData: (data: T[]) => void; onError?: (e: unknown) => void };

const mocks = vi.hoisted(() => ({
  auth: { user: { uid: "ana", displayName: "Ana", photoURL: null, providerData: [] } },
  posts: [] as Sub<GroupPost>[],
  messages: [] as Sub<GroupMessage>[],
  toggleLike: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/config/firebase", () => ({ auth: {}, db: {} }));
vi.mock("@/services/database", () => ({
  getGroupById: () => Promise.resolve(group),
  getUserProfile: () => Promise.resolve({ uid: "ana", joinedGroupIds: [] }),
  subscribeToGroupPosts: (_id: string, onData: Sub<GroupPost>["onData"], _limit?: number, onError?: Sub<GroupPost>["onError"]) => {
    mocks.posts.push({ onData, onError });
    return () => undefined;
  },
  subscribeToGroupMessages: (_id: string, onData: Sub<GroupMessage>["onData"], _limit?: number, onError?: Sub<GroupMessage>["onError"]) => {
    mocks.messages.push({ onData, onError });
    return () => undefined;
  },
  subscribeToGroupPostComments: () => () => undefined,
  addGroupPostComment: vi.fn(),
  createGroupPost: vi.fn(),
  joinGroup: vi.fn(),
  leaveGroup: vi.fn(),
  sendGroupMessage: vi.fn(),
  toggleGroupPostLike: (...a: unknown[]) => mocks.toggleLike(...a),
}));
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => mocks.error(...a), success: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

import Group from "@/pages/app/Group";

const group: RunningGroup = {
  id: "7", name: "Corrida de Sábado", city: "Campinas", description: "Longão", tag: "10K",
  createdBy: "bruno", creatorName: "Bruno", memberIds: ["bruno", "ana"], membersCount: 2, weeklyKm: 12,
};

const post: GroupPost = { id: "1", authorId: "bruno", authorName: "Bruno", authorPhoto: null, text: "Bora correr", likes: [], commentsCount: 0 };

const renderGroup = () => render(
  <MemoryRouter initialEntries={["/grupo/7"]}>
    <Routes><Route path="/grupo/:groupId" element={<Group />} /></Routes>
  </MemoryRouter>,
);

describe("feed e chat do grupo", () => {
  beforeEach(() => {
    mocks.posts.length = 0;
    mocks.messages.length = 0;
    mocks.toggleLike.mockReset().mockResolvedValue(undefined);
    mocks.error.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("se as publicações não carregarem, mostra o erro e deixa tentar de novo", async () => {
    renderGroup();
    await waitFor(() => expect(mocks.posts.length).toBeGreaterThan(0));
    mocks.posts.at(-1)!.onError?.(new Error("offline"));
    fireEvent.click(await screen.findByRole("button", { name: "Tentar carregar as publicações de novo" }));
    await waitFor(() => expect(mocks.posts.length).toBe(2));
    mocks.posts.at(-1)!.onData([post]);
    expect(await screen.findByText("Bora correr")).toBeInTheDocument();
  });

  it("se o chat não carregar, mostra o erro em vez do carregando", async () => {
    renderGroup();
    await waitFor(() => expect(mocks.messages.length).toBeGreaterThan(0));
    mocks.messages.at(-1)!.onError?.(new Error("offline"));
    expect(await screen.findByRole("button", { name: "Tentar carregar as mensagens de novo" })).toBeInTheDocument();
  });

  it("avisa quando a curtida de uma publicação não é salva", async () => {
    mocks.toggleLike.mockRejectedValue(new Error("offline"));
    renderGroup();
    await waitFor(() => expect(mocks.posts.length).toBeGreaterThan(0));
    mocks.posts.at(-1)!.onData([post]);
    fireEvent.click((await screen.findAllByRole("button", { name: "Curtir" }))[0]);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Não foi possível salvar a curtida. Tente de novo."));
  });
});
