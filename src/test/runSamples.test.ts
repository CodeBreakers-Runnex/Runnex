import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { useRunSamples } from "@/hooks/useRunSamples";
const initial = { running: false, paused: false, distance: 0, seconds: 0 };
const setup = () => renderHook(p => useRunSamples(p.running, p.paused, p.distance, p.seconds), { initialProps: initial });
it("preserves stops and separates paused segments", () => {
  const { result, rerender } = setup();
  act(() => result.current.reset());
  rerender({ ...initial, running: true, distance: .5, seconds: 100 });
  rerender({ ...initial, running: true, distance: .5, seconds: 110 });
  expect(result.current.snapshot().performanceSamples.at(-1)?.elapsedSeconds).toBe(110);
  rerender({ running: true, paused: true, distance: .5, seconds: 110 });
  rerender({ running: true, paused: false, distance: .6, seconds: 120 });
  const points = result.current.snapshot().performanceSamples;
  expect(points.at(-1)?.segmentId).not.toBe(points.at(-2)?.segmentId);
});
it("resumes in a new segment without mutating the saved snapshot", () => {
  const { result, rerender } = setup();
  const saved = { performanceSamples: [{ elapsedSeconds: 0, distanceKm: 0, segmentId: 0 }, { elapsedSeconds: 100, distanceKm: .5, segmentId: 0 }], heartRateSamples: [] };
  act(() => result.current.restore(saved));
  rerender({ ...initial, running: true, distance: .6, seconds: 120 });
  expect(result.current.snapshot().performanceSamples.at(-1)?.segmentId).toBe(1);
  expect(saved.performanceSamples).toHaveLength(2);
});
it("excludes paused heart readings and breaks after a reconnect", () => {
  const { result, rerender } = setup();
  rerender({ ...initial, running: true, seconds: 1 });
  act(() => result.current.recordHeartRate(120, 200));
  rerender({ ...initial, running: true, paused: true, seconds: 2 });
  act(() => result.current.recordHeartRate(130, 200));
  rerender({ ...initial, running: true, seconds: 3 });
  act(() => result.current.recordHeartRate(140, 200));
  act(() => result.current.breakHeartRateSegment());
  rerender({ ...initial, running: true, seconds: 5 });
  act(() => result.current.recordHeartRate(160, 200));
  const samples = result.current.snapshot().heartRateSamples;
  expect(samples.map(s => s.bpm)).toEqual([120, 140, 160]);
  expect(new Set(samples.map(s => s.segmentId)).size).toBe(3);
});
it("keeps the reference fixed once readings are recorded", () => {
  const { result, rerender } = setup();
  rerender({ ...initial, running: true, seconds: 1 });
  act(() => result.current.recordHeartRate(120, 200));
  rerender({ ...initial, running: true, seconds: 2 });
  act(() => result.current.recordHeartRate(150, 180));
  expect(result.current.snapshot().heartRateSamples).toHaveLength(1);
  expect(result.current.snapshot().heartRateMaxBpm).toBe(200);
});
