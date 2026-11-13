import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { RunningGroup } from "@/types";

// A aba Grupos lê o perfil só para saber em quais grupos a pessoa está. Se o
// perfil não carregar, a lista de grupos continua aparecendo (era assim
// quando o serviço devolvia null em caso de erro).

const mocks = vi.hoisted(() => ({
  auth: { user: { uid: "ana", displayName: "Ana", photoURL: null, providerData: [] } },
  getUserProfile: vi.fn(),
  getGroups: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/config/firebase", () => ({ auth: {}, db: {} }));
vi.mock("@/pages/app/Feed", () => ({ default: () => <p>feed</p> }));
vi.mock("@/pages/app/Events", () => ({ default: () => <p>eventos</p> }));
vi.mock("@/services/database", () => ({
  getUserProfile: (...a: unknown[]) => mocks.getUserProfile(...a),
  getGroups: (...a: unknown[]) => mocks.getGroups(...a),
  getGlobalRanking: vi.fn().mockResolvedValue([]),
  getGroupActivities: vi.fn().mockResolvedValue([]),
  getGroupLeaderboard: vi.fn().mockResolvedValue([]),
  createGroup: vi.fn(),
  joinGroup: vi.fn(),
  leaveGroup: vi.fn(),
  updateGroupPhoto: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

import Social from "@/pages/app/Social";

const group: RunningGroup = {
  id: "7", name: "Corrida de Sábado", city: "Campinas", description: "Longão", tag: "10K",
  createdBy: "bruno", creatorName: "Bruno", memberIds: ["bruno"], membersCount: 1, weeklyKm: 12,
};

describe("aba de grupos", () => {
  beforeEach(() => {
    mocks.getGroups.mockReset().mockResolvedValue([group]);
    mocks.getUserProfile.mockReset().mockResolvedValue({ uid: "ana", joinedGroupIds: [] });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("lista os grupos mesmo se o perfil não carregar", async () => {
    mocks.getUserProfile.mockRejectedValue(new Error("offline"));
    render(<MemoryRouter><Social /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Grupos/ }));
    expect((await screen.findAllByText("Corrida de Sábado")).length).toBeGreaterThan(0);
  });
});
