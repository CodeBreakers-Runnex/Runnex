import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import PersonalRecords from "@/components/performance/PersonalRecords";
import { api } from "@/services/apiClient";
vi.mock("@/services/apiClient", () => ({ api: { get: vi.fn() } }));
const get = vi.mocked(api.get);
const empty = { records: [{ label: "1 km", distanceKm: 1, best: null }] };
beforeEach(() => vi.resetAllMocks());
it("does not invent a record for legacy or empty history", async () => {
  get.mockResolvedValue(empty);
  render(<PersonalRecords userId="ana" />);
  expect(await screen.findByText("Ainda sem registro")).toBeInTheDocument();
});
it("formats the fastest measured segment and its date", async () => {
  get.mockResolvedValue({ records: [{ label: "1 km", distanceKm: 1, best: { activityId: "a", durationSeconds: 245, date: "2026-10-08T12:00:00Z" } }] });
  render(<PersonalRecords userId="ana" />);
  expect(await screen.findByText("04:05")).toBeInTheDocument();
});
it("allows retry after a network error", async () => {
  get.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(empty);
  render(<PersonalRecords userId="ana" />);
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(await screen.findByText("Ainda sem registro")).toBeInTheDocument();
});
