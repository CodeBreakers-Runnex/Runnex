import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useHeartRateSensor } from "@/hooks/useHeartRateSensor";
import { connectHeartRate } from "@/services/heartRateSensor";
vi.mock("@/services/heartRateSensor", () => ({ connectHeartRate: vi.fn() }));
const connectMock = vi.mocked(connectHeartRate);
function setup(reference?: number) {
  const onReading = vi.fn(); const onBreak = vi.fn();
  return { ...renderHook(() => useHeartRateSensor({ reference, onReading, onBreak })), onReading, onBreak };
}
beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.useRealTimers());
it("rejects missing reference before contacting Bluetooth", async () => {
  const { result } = setup();
  await act(() => result.current.connect());
  expect(connectMock).not.toHaveBeenCalled();
  expect(result.current.sensorError).toContain("FC máxima");
});
it("allows only one pending connection and closes it after unmount", async () => {
  let resolve!: (sensor: { name: string; disconnect: () => Promise<void> }) => void;
  connectMock.mockImplementation(() => new Promise(r => { resolve = r; }));
  const { result, unmount, onReading } = setup(200);
  let pending!: Promise<void>;
  act(() => { pending = result.current.connect(); void result.current.connect(); });
  expect(connectMock).toHaveBeenCalledTimes(1);
  unmount();
  const disconnect = vi.fn().mockResolvedValue(undefined);
  await act(async () => { resolve({ name: "Test", disconnect }); await pending; });
  expect(disconnect).toHaveBeenCalledOnce();
  act(() => connectMock.mock.calls[0][0](130));
  expect(onReading).not.toHaveBeenCalled();
});
it("uses a fixed reference, breaks gaps and ignores stale connection callbacks", async () => {
  connectMock.mockResolvedValue({ name: "Test", disconnect: vi.fn().mockResolvedValue(undefined) });
  const { result, onReading, onBreak } = setup(200);
  await act(() => result.current.connect());
  act(() => connectMock.mock.calls[0][0](140));
  expect(onReading).toHaveBeenLastCalledWith(140, 200);
  onBreak.mockClear();
  act(() => connectMock.mock.calls[0][2]());
  expect(result.current.bpm).toBeNull();
  expect(onBreak).toHaveBeenCalledOnce();
  await act(() => result.current.disconnect());
  await act(() => result.current.connect());
  act(() => { connectMock.mock.calls[1][0](160); connectMock.mock.calls[0][1](); connectMock.mock.calls[0][0](220); });
  expect(result.current.sensorName).toBe("Test");
  expect(result.current.bpm).toBe(160);
});
it("expires stale readings without extending measured coverage", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
  connectMock.mockResolvedValue({ name: "Test", disconnect: vi.fn().mockResolvedValue(undefined) });
  const { result, onBreak } = setup(200);
  await act(() => result.current.connect());
  act(() => connectMock.mock.calls[0][0](120));
  onBreak.mockClear();
  act(() => vi.advanceTimersByTime(12000));
  expect(result.current.bpm).toBeNull();
  expect(onBreak).toHaveBeenCalledOnce();
});
it("handles disconnect failures without rejecting the UI promise", async () => {
  connectMock.mockResolvedValue({ name: "Test", disconnect: vi.fn().mockRejectedValue(new Error("lost")) });
  const { result } = setup(200);
  await act(() => result.current.connect());
  await act(() => result.current.disconnect());
  expect(result.current.sensorName).toBe("");
  expect(result.current.sensorError).toContain("perdeu a conexão");
});
it("allows retry after connection failure", async () => {
  connectMock.mockRejectedValueOnce(new Error("denied")).mockResolvedValueOnce({ name: "Test", disconnect: vi.fn().mockResolvedValue(undefined) });
  const { result } = setup(200);
  await act(() => result.current.connect());
  expect(result.current.connecting).toBe(false);
  await act(() => result.current.connect());
  expect(result.current.sensorName).toBe("Test");
});
