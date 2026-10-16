import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import EvolutionInsights from "@/components/performance/EvolutionInsights";
import { api } from "@/services/apiClient";
vi.mock("@/services/apiClient", () => ({ api: { get: vi.fn() } }));
const get = vi.mocked(api.get);
const period = (start: string, km: number, pace: number | null, inProgress = false) => ({ start, km, runs: km ? 1 : 0, durationSeconds: km * (pace ?? 0), paceSecondsPerKm: pace, inProgress });
beforeEach(() => vi.resetAllMocks());
it("compares calendar periods and switches to monthly totals", async () => {
  get.mockResolvedValue({ evolution: {
    week: [period("2026-09-28", 10, 360), period("2026-10-05", 15, 300, true)],
    month: [period("2026-09-01", 80, 360), period("2026-10-01", 40, 300, true)],
  } });
  render(<EvolutionInsights userId="ana" />);
  expect(await screen.findByText("15.00 km")).toBeInTheDocument();
  expect(screen.getByText(/\+50.0%/)).toBeInTheDocument();
  expect(screen.getByText(/-16.7%/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Meses" }));
  expect(screen.getByText("40.00 km")).toBeInTheDocument();
  expect(screen.getByText(/-50.0%/)).toBeInTheDocument();
  expect(screen.getByText(/Mês atual em andamento/)).toBeInTheDocument();
});
it("shows unavailable pace without dividing by zero", async () => {
  const empty = [period("2026-09-28", 0, null), period("2026-10-05", 0, null, true)];
  get.mockResolvedValue({ evolution: { week: empty, month: empty } });
  render(<EvolutionInsights userId="ana" />);
  expect(await screen.findByText("Sem comparação")).toBeInTheDocument();
  expect(screen.getByText(/Sem variação/)).toBeInTheDocument();
  expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
});
it("ignores a late response from the previous account", async () => {
  let resolve!: (value: unknown) => void;
  get.mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValueOnce({ evolution: { week: [], month: [] } });
  const { rerender } = render(<EvolutionInsights userId="ana" />);
  rerender(<EvolutionInsights userId="bia" />);
  await screen.findByText(/Ainda não há períodos/);
  await act(async () => { resolve({ evolution: { week: [period("2026-09-28", 10, 360), period("2026-10-05", 99, 300)], month: [] } }); });
  expect(screen.queryByText("99.00 km")).not.toBeInTheDocument();
});
