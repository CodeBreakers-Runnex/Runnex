import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { RunningGroup } from "@/types";

// A tela do grupo lê o perfil só para saber se a pessoa entrou num grupo de
// demonstração. Para grupos reais quem decide é group.memberIds; se o perfil
// não carregar, o membro continua vendo o grupo (como era quando o serviço
// devolvia null em caso de erro).

const mocks = vi.hoisted(() => ({
  auth: { user: { uid: "ana", displayName: "Ana", photoURL: null, providerData: [] } },
  getGroupById: vi.fn(),
  getUserProfile: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/config/firebase", () => ({ auth: {}, db: {} }));
vi.mock("@/services/database", () => ({
  getGroupById: (...a: unknown[]) => mocks.getGroupById(...a),
  getUserProfile: (...a: unknown[]) => mocks.getUserProfile(...a),
  subscribeToGroupPosts: () => () => undefined,
  subscribeToGroupMessages: () => () => undefined,
  subscribeToGroupPostComments: () => () => undefined,
  addGroupPostComment: vi.fn(),
  createGroupPost: vi.fn(),
  joinGroup: vi.fn(),
  leaveGroup: vi.fn(),
  sendGroupMessage: vi.fn(),
  toggleGroupPostLike: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

import Group from "@/pages/app/Group";

const group: RunningGroup = {
  id: "7", name: "Corrida de Sábado", city: "Campinas", description: "Longão", tag: "10K",
  createdBy: "bruno", creatorName: "Bruno", memberIds: ["bruno", "ana"], membersCount: 2, weeklyKm: 12,
};

const renderGroup = () => render(
  <MemoryRouter initialEntries={["/grupo/7"]}>
    <Routes><Route path="/grupo/:groupId" element={<Group />} /></Routes>
  </MemoryRouter>,
);

describe("tela do grupo", () => {
  beforeEach(() => {
    mocks.getGroupById.mockReset().mockResolvedValue(group);
    mocks.getUserProfile.mockReset().mockResolvedValue({ uid: "ana", joinedGroupIds: [] });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("membro vê o grupo mesmo se o perfil não carregar", async () => {
    mocks.getUserProfile.mockRejectedValue(new Error("offline"));
    renderGroup();
    expect((await screen.findAllByText("Corrida de Sábado")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Erro ao carregar dados")).toBeNull();
    expect(screen.queryByRole("button", { name: /Entrar no grupo/i })).toBeNull();
  });

  it("se o grupo não carregar, mostra o erro com 'tentar novamente'", async () => {
    mocks.getGroupById.mockRejectedValue(new Error("offline"));
    renderGroup();
    expect(await screen.findByText("Erro ao carregar dados")).toBeInTheDocument();
  });
});
