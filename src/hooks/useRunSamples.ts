import { useCallback, useEffect, useRef } from "react";
export type RunPerformance = {
  performanceSamples: { elapsedSeconds: number; distanceKm: number; segmentId?: number }[];
  heartRateSamples: { elapsedSeconds: number; bpm: number; segmentId?: number }[];
  heartRateMaxBpm?: number;
};
export function useRunSamples(running: boolean, paused: boolean, distance: number, seconds: number) {
  const performanceSegment = useRef(0);
  const heartSegment = useRef(0);
  const wasActive = useRef(false);
  const current = useRef({ running, paused, seconds });
  current.current = { running, paused, seconds };
  const data = useRef<RunPerformance>({ performanceSamples: [], heartRateSamples: [] });
  useEffect(() => {
    const active = running && !paused;
    if (wasActive.current && !active) {
      performanceSegment.current++;
      heartSegment.current++;
    }
    wasActive.current = active;
    if (!active || distance < 0 || seconds <= 0) return;
    const points = data.current.performanceSamples;
    const last = points[points.length - 1];
    if (!last || (distance >= last.distanceKm && seconds > last.elapsedSeconds)) {
      const previous = points[points.length - 2];
      // Keep arrival/departure times without storing every stationary tick.
      if (previous && previous.distanceKm === distance && last.distanceKm === distance
          && previous.segmentId === performanceSegment.current && last.segmentId === performanceSegment.current) {
        last.elapsedSeconds = seconds;
      } else {
        points.push({ elapsedSeconds: seconds, distanceKm: distance, segmentId: performanceSegment.current });
      }
      if (points.length > 5000) {
        data.current.performanceSamples = points.filter((_, i) => i === 0 || i === points.length - 1 || i % 2 === 0);
      }
    }
  }, [running, paused, distance, seconds]);


  const recordHeartRate = useCallback((bpm: number, reference: number) => {
    const state = current.current;
    if (!Number.isInteger(bpm) || bpm < 25 || bpm > 250 || !Number.isInteger(reference) || reference < 100 || reference > 250) return;
    const samples = data.current.heartRateSamples;
    if (state.running && !state.paused && samples.length < 90000 && (!samples.length || state.seconds > samples[samples.length - 1].elapsedSeconds)) {
      if (data.current.heartRateMaxBpm !== undefined && data.current.heartRateMaxBpm !== reference) return;
      data.current.heartRateMaxBpm = reference;
      samples.push({ elapsedSeconds: state.seconds, bpm, segmentId: heartSegment.current });
    }
  }, []);
  const breakHeartRateSegment = useCallback(() => { heartSegment.current++; }, []);
  const reset = useCallback(() => {
    performanceSegment.current = 0;
    heartSegment.current = 0;
    data.current = { performanceSamples: [{ elapsedSeconds: 0, distanceKm: 0, segmentId: 0 }], heartRateSamples: [] };
  }, []);
  const restore = useCallback((snapshot?: RunPerformance) => {
    data.current = snapshot ? {
      performanceSamples: snapshot.performanceSamples.map(p => ({ ...p })),
      heartRateSamples: snapshot.heartRateSamples.map(p => ({ ...p })),
      heartRateMaxBpm: snapshot.heartRateMaxBpm,
    } : { performanceSamples: [], heartRateSamples: [] };
    performanceSegment.current = (data.current.performanceSamples.at(-1)?.segmentId ?? 0) + 1;
    heartSegment.current = (data.current.heartRateSamples.at(-1)?.segmentId ?? 0) + 1;
  }, []);
  const snapshot = useCallback((): RunPerformance => ({
    performanceSamples: data.current.performanceSamples.map(p => ({ ...p })), heartRateSamples: data.current.heartRateSamples.map(p => ({ ...p })),
    heartRateMaxBpm: data.current.heartRateMaxBpm,
  }), []);
  return { reset, restore, snapshot, recordHeartRate, breakHeartRateSegment };
}
