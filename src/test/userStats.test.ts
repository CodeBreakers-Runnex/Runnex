import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/services/apiClient", () => ({ api, ApiError: class extends Error {}, OWN_DATA_CACHE_MS: 10_000 }));

import { getUserStats } from "@/services/activitiesApi";

const run = { id: "7", distance: 12, durationSeconds: 3500, timestamp: "2026-10-27T12:00:00Z" };

describe("getUserStats", () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it("usa o endpoint do servidor, com o fuso, e só formata", async () => {
    api.get.mockResolvedValue({
      totalKm: 17, runsCount: 2, totalSeconds: 5300, totalCalories: 640.4, currentStreak: 3,
      weeklyTotalKm: 17, weeklyData: [{ day: "QUA", km: 17 }], hasHourLongRun: false, hasSub10kRun: true,
      dawnRunsCount: 1, nightRunsCount: 0, bestActivity: run, lastActivity: null,
    });

    const stats = await getUserStats("ana");

    const url = api.get.mock.calls[0][0] as string;
    expect(url).toBe(`/activities/stats/me?utc_offset_minutes=${-new Date().getTimezoneOffset()}`);
    expect(url).not.toContain("limit");
    expect(stats.totalKm).toBe("17.0");
    expect(stats.totalTime).toBe("1h 28m");
    expect(stats.averagePace).toBe("5'12\"");
    expect(stats.totalCalories).toBe(640);
    expect(stats.currentStreak).toBe(3);
    expect(stats.bestActivity?.id).toBe("7");
    expect(stats.lastActivity).toBeNull();
    expect(stats.hasSub10kRun).toBe(true);
  });

  it("devolve zeros se o servidor falhar", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    api.get.mockRejectedValue(new Error("offline"));
    const stats = await getUserStats("ana");
    expect(stats.runsCount).toBe(0);
    expect(stats.totalKm).toBe("0.0");
  });
});
