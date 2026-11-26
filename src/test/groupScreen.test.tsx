import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { GroupMessage, GroupPost, RunningGroup } from "@/types";

// Fixa o comportamento da tela do grupo antes de dividir Group.tsx em
// arquivos: visitante entra no grupo; membro vê publicações e chat, publica,
// comenta, curte, manda mensagem e sai; grupo de demonstração não tem feed.

const mocks = vi.hoisted(() => ({
  auth: { user: { uid: "ana", displayName: "Ana", photoURL: null, providerData: [] } },
  group: null as unknown,
  posts: [] as unknown[],
  messages: [] as unknown[],
  comments: [] as unknown[],
  joinGroup: vi.fn(),
  leaveGroup: vi.fn(),
  createGroupPost: vi.fn(),
  addGroupPostComment: vi.fn(),
  sendGroupMessage: vi.fn(),
  toggleGroupPostLike: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/config/firebase", () => ({ auth: {}, db: {} }));
vi.mock("react-router-dom", async () => ({ ...await vi.importActual("react-router-dom"), useNavigate: () => mocks.navigate }));
vi.mock("@/services/database", () => ({
  getGroupById: () => Promise.resolve(mocks.group),
  getUserProfile: () => Promise.resolve({ uid: "ana", joinedGroupIds: [] }),
  subscribeToGroupPosts: (_id: string, cb: (data: unknown[]) => void) => { cb(mocks.posts); return () => undefined; },
  subscribeToGroupMessages: (_id: string, cb: (data: unknown[]) => void) => { cb(mocks.messages); return () => undefined; },
  subscribeToGroupPostComments: (_g: string, _p: string, cb: (data: unknown[]) => void) => { cb(mocks.comments); return () => undefined; },
  joinGroup: (...a: unknown[]) => mocks.joinGroup(...a),
  leaveGroup: (...a: unknown[]) => mocks.leaveGroup(...a),
  createGroupPost: (...a: unknown[]) => mocks.createGroupPost(...a),
  addGroupPostComment: (...a: unknown[]) => mocks.addGroupPostComment(...a),
  sendGroupMessage: (...a: unknown[]) => mocks.sendGroupMessage(...a),
  toggleGroupPostLike: (...a: unknown[]) => mocks.toggleGroupPostLike(...a),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

import Group from "@/pages/app/Group";

const base: RunningGroup = {
  id: "7", name: "Corrida de Sábado", city: "Campinas", description: "Longão de sábado", tag: "10K",
  createdBy: "bruno", creatorName: "Bruno", memberIds: ["bruno", "ana"], membersCount: 2, weeklyKm: 12,
};
const post: GroupPost = { id: "1", authorId: "bruno", authorName: "Bruno", authorPhoto: null, text: "Bora correr", likes: [], commentsCount: 1 };
const message: GroupMessage = { id: "m1", senderId: "bruno", senderName: "Bruno", senderPhoto: null, text: "Chego em 10 min" };

const renderGroup = () => render(
  <MemoryRouter initialEntries={["/grupo/7"]}>
    <Routes><Route path="/grupo/:groupId" element={<Group />} /></Routes>
  </MemoryRouter>,
);

describe("tela do grupo", () => {
  beforeEach(() => {
    mocks.group = base;
    mocks.posts = [post];
    mocks.messages = [message];
    mocks.comments = [{ id: "c1", authorId: "ana", authorName: "Ana", authorPhoto: null, text: "Partiu!" }];
    for (const fn of [mocks.joinGroup, mocks.leaveGroup, mocks.createGroupPost, mocks.addGroupPostComment, mocks.sendGroupMessage, mocks.toggleGroupPostLike, mocks.navigate]) {
      fn.mockReset().mockResolvedValue(undefined);
    }
    vi.spyOn(console, "error").mockImplementation(() => {});
    // jsdom não implementa scrollIntoView (o chat rola até a última mensagem).
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("visitante vê o convite e entra no grupo", async () => {
    mocks.group = { ...base, memberIds: ["bruno"], membersCount: 1 };
    renderGroup();
    expect(await screen.findByText("Você ainda não participa deste grupo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Entrar no grupo/ }));
    await waitFor(() => expect(mocks.joinGroup).toHaveBeenCalledWith("7", "ana"));
  });

  it("membro vê publicações e mensagens do chat", async () => {
    renderGroup();
    expect((await screen.findAllByText("Bora correr")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Chego em 10 min").length).toBeGreaterThan(0);
  });

  it("publica um texto no grupo", async () => {
    renderGroup();
    fireEvent.click((await screen.findAllByText("O que você quer compartilhar com o grupo?"))[0]);
    fireEvent.change(screen.getByPlaceholderText("O que você quer compartilhar com o grupo?"), { target: { value: "Treino amanhã" } });
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));
    await waitFor(() => expect(mocks.createGroupPost).toHaveBeenCalledWith(expect.objectContaining({ groupId: "7", text: "Treino amanhã", imageURL: null })));
  });

  it("curte, abre comentários e comenta", async () => {
    renderGroup();
    fireEvent.click((await screen.findAllByRole("button", { name: "Curtir" }))[0]);
    expect(mocks.toggleGroupPostLike).toHaveBeenCalledWith("7", "1", "ana", false);
    fireEvent.click(screen.getAllByRole("button", { name: "Comentários" })[0]);
    expect((await screen.findAllByText("Partiu!")).length).toBeGreaterThan(0);
    fireEvent.change(screen.getAllByPlaceholderText("Escreva um comentário...")[0], { target: { value: "Vou junto" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Enviar comentário" })[0]);
    await waitFor(() => expect(mocks.addGroupPostComment).toHaveBeenCalledWith("7", "1", expect.objectContaining({ text: "Vou junto" })));
  });

  it("manda mensagem no chat", async () => {
    renderGroup();
    const input = (await screen.findAllByPlaceholderText("Escreva uma mensagem..."))[0];
    fireEvent.change(input, { target: { value: "Bom dia" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Enviar mensagem" })[0]);
    await waitFor(() => expect(mocks.sendGroupMessage).toHaveBeenCalledWith(expect.objectContaining({ groupId: "7", text: "Bom dia" })));
  });

  it("sai do grupo pelas opções e volta para a lista", async () => {
    renderGroup();
    fireEvent.click(await screen.findByRole("button", { name: "Opções do grupo" }));
    fireEvent.click(await screen.findByRole("button", { name: /Sair do grupo/ }));
    await waitFor(() => expect(mocks.leaveGroup).toHaveBeenCalledWith("7", "ana"));
    expect(mocks.navigate).toHaveBeenCalledWith("/social");
  });

  it("grupo de demonstração não tem feed nem chat", async () => {
    mocks.group = { ...base, id: "sp-runners", createdBy: "system", memberIds: ["ana"] };
    renderGroup();
    expect(await screen.findByText(/Feed e chat ficam disponíveis em grupos criados de verdade/)).toBeInTheDocument();
    expect(screen.queryByText("Bora correr")).toBeNull();
  });
});
