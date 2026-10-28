import { useEffect } from "react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { flushQueuedRuns, getQueuedRuns } from "@/services/offlineRuns";

const RETRY_INTERVAL_MS = 60_000;

/** Reenvia as corridas guardadas sem internet assim que der. */
export default function OfflineRunSync() {
  const { user } = useAuth();
  const uid = user?.uid;

  useEffect(() => {
    if (!uid) return undefined;
    let live = true;

    const flush = async () => {
      if (getQueuedRuns(uid).length === 0) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      const result = await flushQueuedRuns(uid);
      if (!live) return;
      for (const { payload } of result.sent) {
        toast.success(`Corrida de ${payload.distance.toFixed(2)} km enviada.`);
      }
      for (const { run, reason } of result.rejected) {
        toast.error(`A corrida de ${run.payload.distance.toFixed(2)} km foi recusada pelo servidor: ${reason}`, { duration: 10000 });
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void flush();
    };

    void flush();
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => void flush(), RETRY_INTERVAL_MS);

    return () => {
      live = false;
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [uid]);

  return null;
}
