import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Se a lista de grupos não carregar, a aba avisa (antes mostrava os grupos
// de demonstração como se fossem reais).

const mocks = vi.hoisted(() => ({
  auth: { user: { uid: "ana", displayName: "Ana", photoURL: null, providerData: [] } },
  getGroups: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/config/firebase", () => ({ auth: {}, db: {} }));
vi.mock("@/pages/app/Feed", () => ({ default: () => <p>feed</p> }));
vi.mock("@/pages/app/Events", () => ({ default: () => <p>eventos</p> }));
vi.mock("@/services/database", () => ({
  getUserProfile: () => Promise.resolve({ uid: "ana", joinedGroupIds: [] }),
  getGroups: (...a: unknown[]) => mocks.getGroups(...a),
  getGlobalRanking: vi.fn().mockResolvedValue([]),
  getGroupActivities: vi.fn().mockResolvedValue([]),
  getGroupLeaderboard: vi.fn().mockResolvedValue([]),
  createGroup: vi.fn(),
  joinGroup: vi.fn(),
  leaveGroup: vi.fn(),
  updateGroupPhoto: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => mocks.error(...a), success: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

import Social from "@/pages/app/Social";

describe("aba de grupos com o servidor fora", () => {
  beforeEach(() => {
    mocks.getGroups.mockReset();
    mocks.error.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("avisa que não conseguiu carregar os grupos", async () => {
    mocks.getGroups.mockRejectedValue(new Error("offline"));
    render(<MemoryRouter><Social /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Grupos/ }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Não foi possível carregar os grupos. Tente de novo."));
  });
});
