import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "@/services/apiClient";
import type { RunningGroup } from "@/types";

// Grupo privado no app: cadeado na lista, código pedido ao entrar, código
// mostrado uma vez ao criar e botão de gerar outro para o criador.

const mocks = vi.hoisted(() => ({
  auth: { user: { uid: "ana", displayName: "Ana", photoURL: null, providerData: [] } },
  getUserProfile: vi.fn(),
  getGroups: vi.fn(),
  getGroupById: vi.fn(),
  createGroup: vi.fn(),
  joinGroup: vi.fn(),
  regenerateJoinCode: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/config/firebase", () => ({ auth: {}, db: {} }));
vi.mock("@/pages/app/Feed", () => ({ default: () => <p>feed</p> }));
vi.mock("@/pages/app/Events", () => ({ default: () => <p>eventos</p> }));
vi.mock("@/services/groupsApi", () => ({
  regenerateJoinCode: (...a: unknown[]) => mocks.regenerateJoinCode(...a),
}));
vi.mock("@/services/database", () => ({
  getUserProfile: (...a: unknown[]) => mocks.getUserProfile(...a),
  getGroups: (...a: unknown[]) => mocks.getGroups(...a),
  getGroupById: (...a: unknown[]) => mocks.getGroupById(...a),
  getGlobalRanking: vi.fn().mockResolvedValue([]),
  getGroupActivities: vi.fn().mockResolvedValue([]),
  getGroupLeaderboard: vi.fn().mockResolvedValue([]),
  createGroup: (...a: unknown[]) => mocks.createGroup(...a),
  joinGroup: (...a: unknown[]) => mocks.joinGroup(...a),
  leaveGroup: vi.fn(),
  updateGroupPhoto: vi.fn(),
  subscribeToGroupPosts: () => () => undefined,
  subscribeToGroupMessages: () => () => undefined,
  subscribeToGroupPostComments: () => () => undefined,
  addGroupPostComment: vi.fn(),
  createGroupPost: vi.fn(),
  sendGroupMessage: vi.fn(),
  toggleGroupPostLike: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() } }));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mocks.navigate };
});

import Social from "@/pages/app/Social";
import Group from "@/pages/app/Group";

const privateGroup: RunningGroup = {
  id: "7", name: "Grupo Secreto", city: "Campinas", description: "Só convidados", tag: "10K", isPrivate: true,
  createdBy: "bruno", creatorName: "Bruno", memberIds: [], membersCount: 3, weeklyKm: 12,
};
const publicGroup: RunningGroup = { ...privateGroup, id: "8", name: "Grupo Aberto", isPrivate: false, memberIds: ["bruno"] };

const renderSocialGroups = async () => {
  render(<MemoryRouter><Social /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: /Grupos/ }));
  await screen.findAllByText(/Grupo (Secreto|Aberto)/);
};

describe("grupo privado na aba Grupos", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => "mockReset" in mock && mock.mockReset());
    mocks.getGroups.mockResolvedValue([privateGroup, publicGroup]);
    mocks.getUserProfile.mockResolvedValue({ uid: "ana", joinedGroupIds: [] });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("mostra o cadeado só no grupo privado", async () => {
    await renderSocialGroups();
    expect(screen.getAllByLabelText("Grupo privado")).toHaveLength(1);
  });

  it("entrar num grupo privado pede o código antes de chamar o servidor", async () => {
    await renderSocialGroups();
    fireEvent.click(screen.getByRole("button", { name: /Entrar no grupo/ }));
    expect(await screen.findByLabelText("Código do grupo")).toBeTruthy();
    expect(mocks.joinGroup).not.toHaveBeenCalled();

    mocks.joinGroup.mockResolvedValue(true);
    fireEvent.change(screen.getByLabelText("Código do grupo"), { target: { value: " abc123xyz9 " } });
    fireEvent.click(screen.getAllByRole("button", { name: /Entrar no grupo/ }).at(-1)!);
    await waitFor(() => expect(mocks.joinGroup).toHaveBeenCalledWith("7", "ana", "abc123xyz9"));
    expect(mocks.navigate).toHaveBeenCalledWith("/grupo/7");
  });

  it("código errado mostra o aviso e não entra", async () => {
    mocks.joinGroup.mockRejectedValue(new ApiError(403, "Codigo do grupo invalido."));
    await renderSocialGroups();
    fireEvent.click(screen.getByRole("button", { name: /Entrar no grupo/ }));
    fireEvent.change(await screen.findByLabelText("Código do grupo"), { target: { value: "ERRADO" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Entrar no grupo/ }).at(-1)!);
    expect((await screen.findByRole("alert")).textContent).toMatch(/Código inválido/);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("bloqueio por tentativas aparece como aviso próprio", async () => {
    mocks.joinGroup.mockRejectedValue(new ApiError(429, "Muitas tentativas"));
    await renderSocialGroups();
    fireEvent.click(screen.getByRole("button", { name: /Entrar no grupo/ }));
    fireEvent.change(await screen.findByLabelText("Código do grupo"), { target: { value: "QUALQUER1" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Entrar no grupo/ }).at(-1)!);
    expect((await screen.findByRole("alert")).textContent).toMatch(/Muitas tentativas/);
  });

  it("grupo público entra direto, sem pedir código", async () => {
    mocks.joinGroup.mockResolvedValue(true);
    mocks.getGroups.mockResolvedValue([publicGroup]);
    await renderSocialGroups();
    fireEvent.click(screen.getByRole("button", { name: /Entrar no grupo/ }));
    await waitFor(() => expect(mocks.joinGroup).toHaveBeenCalledWith("8", "ana", undefined));
    expect(screen.queryByLabelText("Código do grupo")).toBeNull();
  });

  it("sem VIP, a caixa de grupo privado fica desabilitada", async () => {
    mocks.createGroup.mockResolvedValue({ id: "9", joinCode: null });
    await renderSocialGroups();
    fireEvent.click(screen.getByLabelText("Criar grupo"));
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
    expect(screen.getByText(/Benefício do plano VIP/)).toBeTruthy();
  });

  it("criar grupo privado envia isPrivate e mostra o código uma vez", async () => {
    mocks.getUserProfile.mockResolvedValue({ uid: "ana", joinedGroupIds: [], isVip: true });
    mocks.createGroup.mockResolvedValue({ id: "9", joinCode: "K7M2QX9TPA" });
    await renderSocialGroups();
    fireEvent.click(screen.getByLabelText("Criar grupo"));
    fireEvent.change(screen.getByPlaceholderText("Ex: Longao de domingo"), { target: { value: "Meu Grupo" } });
    fireEvent.change(screen.getByPlaceholderText("Ex: Sao Paulo, SP"), { target: { value: "Santos" } });
    fireEvent.change(screen.getByPlaceholderText("Ex: 10K"), { target: { value: "5K" } });
    fireEvent.change(screen.getByPlaceholderText("Conte o objetivo do grupo"), { target: { value: "Treino leve" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Criar comunidade/ }));

    await waitFor(() => expect(mocks.createGroup).toHaveBeenCalledWith(expect.objectContaining({ name: "Meu Grupo", isPrivate: true })));
    expect((await screen.findByTestId("group-code")).textContent).toBe("K7M2QX9TPA");
  });

  it("grupo público criado não mostra código", async () => {
    mocks.createGroup.mockResolvedValue({ id: "9", joinCode: null });
    await renderSocialGroups();
    fireEvent.click(screen.getByLabelText("Criar grupo"));
    fireEvent.change(screen.getByPlaceholderText("Ex: Longao de domingo"), { target: { value: "Meu Grupo" } });
    fireEvent.change(screen.getByPlaceholderText("Ex: Sao Paulo, SP"), { target: { value: "Santos" } });
    fireEvent.change(screen.getByPlaceholderText("Ex: 10K"), { target: { value: "5K" } });
    fireEvent.change(screen.getByPlaceholderText("Conte o objetivo do grupo"), { target: { value: "Treino leve" } });
    fireEvent.click(screen.getByRole("button", { name: /Criar comunidade/ }));
    await waitFor(() => expect(mocks.createGroup).toHaveBeenCalledWith(expect.objectContaining({ isPrivate: false })));
    expect(screen.queryByTestId("group-code")).toBeNull();
  });
});

const renderGroupPage = () =>
  render(
    <MemoryRouter initialEntries={["/grupo/7"]}>
      <Routes><Route path="/grupo/:groupId" element={<Group />} /></Routes>
    </MemoryRouter>,
  );

describe("grupo privado na tela do grupo", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => "mockReset" in mock && mock.mockReset());
    mocks.getUserProfile.mockResolvedValue({ uid: "ana", joinedGroupIds: [] });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("quem não é membro precisa do código", async () => {
    mocks.getGroupById.mockResolvedValue(privateGroup);
    mocks.joinGroup.mockResolvedValue(true);
    renderGroupPage();
    fireEvent.click(await screen.findByRole("button", { name: /Entrar no grupo/ }));
    expect(mocks.joinGroup).not.toHaveBeenCalled();
    fireEvent.change(await screen.findByLabelText("Código do grupo"), { target: { value: "K7M2QX9TPA" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Entrar no grupo/ }).at(-1)!);
    await waitFor(() => expect(mocks.joinGroup).toHaveBeenCalledWith("7", "ana", "K7M2QX9TPA"));
  });

  it("criador de grupo privado gera novo código com confirmação", async () => {
    mocks.getGroupById.mockResolvedValue({ ...privateGroup, createdBy: "ana", memberIds: ["ana"] });
    mocks.regenerateJoinCode.mockResolvedValue("NOVOCODE22");
    renderGroupPage();
    await screen.findAllByText("Grupo Secreto");
    fireEvent.click(screen.getByLabelText(/Opções|Configurações|Opcoes/i));

    fireEvent.click(await screen.findByRole("button", { name: /Gerar novo código/ }));
    expect(mocks.regenerateJoinCode).not.toHaveBeenCalled(); // 1º toque só pede confirmação
    fireEvent.click(screen.getByRole("button", { name: /Confirmar: o código atual deixa de valer/ }));
    await waitFor(() => expect(mocks.regenerateJoinCode).toHaveBeenCalledWith("7"));
    expect((await screen.findByTestId("group-code")).textContent).toBe("NOVOCODE22");
  });

  it("quem não criou o grupo não vê o botão de novo código", async () => {
    mocks.getGroupById.mockResolvedValue({ ...privateGroup, memberIds: ["ana", "bruno"] });
    renderGroupPage();
    await screen.findAllByText("Grupo Secreto");
    fireEvent.click(screen.getByLabelText(/Opções|Configurações|Opcoes/i));
    await screen.findByText("OPÇÕES DO GRUPO");
    expect(screen.queryByRole("button", { name: /Gerar novo código/ })).toBeNull();
  });
});
