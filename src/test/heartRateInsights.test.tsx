import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import HeartRateInsights from "@/components/performance/HeartRateInsights";
import { api } from "@/services/apiClient";
vi.mock("@/services/apiClient", () => ({ api: { get: vi.fn() } }));
const get = vi.mocked(api.get);
beforeEach(() => vi.resetAllMocks());
it("explains the sensor requirement when there is no measurement", async () => {
  get.mockResolvedValue({ heartRate: null });
  render(<HeartRateInsights userId="ana" />);
  expect(await screen.findByText(/GPS sozinho não mede/)).toBeInTheDocument();
});
it("shows measured time and does not invent an average for isolated readings", async () => {
  get.mockResolvedValue({ heartRate: { date: "2026-10-08T12:00:00Z", averageBpm: null, maxBpm: 140, referenceMaxBpm: 200, coveredSeconds: 0, belowZoneSeconds: 0, zones: [1,2,3,4,5].map(zone => ({ zone, seconds: 0 })) } });
  render(<HeartRateInsights userId="ana" />);
  expect(await screen.findByText("140")).toBeInTheDocument();
  expect(screen.getByText("—")).toBeInTheDocument();
  expect(screen.getByText(/Lacunas do sensor não entram/)).toBeInTheDocument();
});
