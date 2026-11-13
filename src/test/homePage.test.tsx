import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { UserStats } from "@/types";

const mocks = vi.hoisted(() => ({
  auth: { user: { uid: "ana", displayName: "Ana Souza", photoURL: null, providerData: [] } },
  getUserStats: vi.fn(),
  getUserActivities: vi.fn(),
  getUserProfile: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/config/firebase", () => ({ auth: {}, db: {} }));
vi.mock("@/services/database", () => ({
  getUserStats: (...a: unknown[]) => mocks.getUserStats(...a),
  getUserActivities: (...a: unknown[]) => mocks.getUserActivities(...a),
  getUserProfile: (...a: unknown[]) => mocks.getUserProfile(...a),
  deleteUserActivity: vi.fn(),
}));
vi.mock("@/components/training/NextWorkoutCard", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => mocks.error(...a), success: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

import Home from "@/pages/app/Home";

const stats: UserStats = {
  totalKm: "42.0", runsCount: 7, totalTime: "3h 30m", totalCalories: 2100, averagePace: "5'00\"",
  currentStreak: 2, weeklyTotalKm: 5, bestActivity: null, lastActivity: null, weeklyData: [],
  hasHourLongRun: false, hasSub10kRun: false, dawnRunsCount: 0, nightRunsCount: 0,
};

const renderHome = () => render(<MemoryRouter><Home /></MemoryRouter>);

describe("início", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.getUserStats.mockReset().mockResolvedValue(stats);
    mocks.getUserActivities.mockReset().mockResolvedValue([]);
    mocks.getUserProfile.mockReset().mockResolvedValue({ uid: "ana", displayName: "Ana Souza", photoURL: null, totalXP: 0, level: "Iniciante", monthlyKm: 0 });
    mocks.error.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("mostra os números da pessoa", async () => {
    renderHome();
    expect(await screen.findByText("7")).toBeInTheDocument();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("se o servidor falhar, avisa em vez de mostrar uma conta zerada calada", async () => {
    mocks.getUserStats.mockRejectedValue(new Error("offline"));
    renderHome();
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Não foi possível carregar seus dados. Confira sua conexão e tente de novo."));
  });
});
