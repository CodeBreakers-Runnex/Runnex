import { useEffect, useState } from "react";
import { api } from "@/services/apiClient";
type Period = { start: string; km: number; runs: number; durationSeconds: number; paceSecondsPerKm: number | null; inProgress: boolean };
export type Performance = {
  records: { label: string; distanceKm: number; best: { activityId: string; durationSeconds: number; date: string } | null }[];
  evolution: { week: Period[]; month: Period[] };
  heartRate: { date: string; averageBpm: number | null; maxBpm: number; referenceMaxBpm: number; coveredSeconds: number; belowZoneSeconds: number; zones: { zone: number; seconds: number }[] } | null;
};

export function usePerformanceSummary(userId: string) {
  const [data, setData] = useState<Performance | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null); setError(false);
    api.get<Performance>(`/activities/performance/me?utc_offset_minutes=${-new Date().getTimezoneOffset()}`)
      .then(result => { if (active) setData(result); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [userId, attempt]);
  return { data, error, retry: () => setAttempt(a => a + 1) };
}
