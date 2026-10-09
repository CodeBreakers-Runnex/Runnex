"""Pure performance calculations. Times are active seconds, distances km."""
from bisect import bisect_left, bisect_right
from datetime import datetime, timedelta, timezone
from itertools import groupby

TARGETS = [("1 km", 1), ("5 km", 5), ("10 km", 10), ("Meia maratona", 21.0975), ("Maratona", 42.195)]


def best_segment(samples: list[dict], target: float) -> float | None:
    candidates = [_continuous_segment(list(group), target)
                  for _, group in groupby(samples, key=lambda p: p.get("segmentId", 0))]
    return min((value for value in candidates if value is not None), default=None)


def _continuous_segment(samples: list[dict], target: float) -> float | None:
    if len(samples) < 2 or samples[-1]["distanceKm"] - samples[0]["distanceKm"] + 1e-9 < target:
        return None
    distances = [p["distanceKm"] for p in samples]
    def at(distance, *, start=False):
        # Clamp floating-point roundoff at the last sample. At a stationary
        # plateau, a segment starts on departure and ends on arrival.
        distance = min(distances[-1], max(distances[0], distance))
        i = bisect_left(distances, distance)
        if distances[i] == distance:
            if start:
                i = bisect_right(distances, distance) - 1
            return samples[i]["elapsedSeconds"]
        if i == 0:
            return samples[0]["elapsedSeconds"]
        a, b = samples[i - 1], samples[i]
        ratio = (distance - a["distanceKm"]) / (b["distanceKm"] - a["distanceKm"])
        return a["elapsedSeconds"] + ratio * (b["elapsedSeconds"] - a["elapsedSeconds"])
    # Both edges of the piecewise-linear curve can change the optimum.
    starts = {d for d in distances if d + target <= distances[-1] + 1e-9}
    starts.update(d - target for d in distances if d - target >= distances[0] - 1e-9)
    return min(at(start + target) - at(start, start=True) for start in starts)


def heart_summary(samples: list[dict], reference: int | None) -> dict | None:
    if not samples or not reference:
        return None
    zones = [0.0] * 5
    weighted, covered = 0.0, 0.0
    for a, b in zip(samples, samples[1:]):
        # Never invent measurements during disconnections (> 10 seconds).
        dt = b["elapsedSeconds"] - a["elapsedSeconds"]
        if a.get("segmentId", 0) != b.get("segmentId", 0) or not 0 < dt <= 10:
            continue
        ratio = a["bpm"] / reference
        if ratio >= .5:
            index = min(4, max(0, int(round(ratio * 100, 6) // 10) - 5))
            zones[index] += dt
        weighted += a["bpm"] * dt
        covered += dt
    return {"averageBpm": round(weighted / covered) if covered else None,
            "maxBpm": max(s["bpm"] for s in samples), "referenceMaxBpm": reference,
            "coveredSeconds": round(covered), "belowZoneSeconds": round(covered - sum(zones)),
            "zones": [{"zone": i + 1, "seconds": round(seconds)} for i, seconds in enumerate(zones)]}


def performance_summary(activities: list, now: datetime, offset: int = 0) -> dict:
    local = timezone(timedelta(minutes=offset))
    records = []
    for label, target in TARGETS:
        best = None
        best_duration = float("inf")
        for a in activities:
            if a.is_simulated:
                continue
            duration = best_segment(a.performance_samples or [], target)
            if duration is not None and duration < best_duration:
                best_duration = duration
                best = {"activityId": str(a.id), "durationSeconds": round(duration, 2), "date": a.created_at.isoformat()}
        records.append({"label": label, "distanceKm": target, "best": best})
    buckets = {}
    today = now.astimezone(local).date()
    for period in ("week", "month"):
        if period == "week":
            current = today - timedelta(days=today.weekday())
            starts = [current - timedelta(weeks=i) for i in reversed(range(8))]
        else:
            month_index = today.year * 12 + today.month - 1
            starts = [today.replace(year=(month_index-i)//12, month=(month_index-i)%12+1, day=1) for i in reversed(range(8))]
        entries = []
        for i, start in enumerate(starts):
            end = starts[i+1] if i+1 < len(starts) else today + timedelta(days=1)
            rows = [a for a in activities if not a.is_simulated and start <= a.created_at.astimezone(local).date() < end]
            km = sum(a.distance for a in rows)
            seconds = sum(a.duration_seconds for a in rows)
            entries.append({"start": start.isoformat(), "km": round(km, 2), "runs": len(rows),
                            "durationSeconds": seconds, "paceSecondsPerKm": round(seconds / km) if km else None,
                            "inProgress": i == len(starts)-1})
        buckets[period] = entries
    latest = next((a for a in activities if not a.is_simulated and a.heart_rate_samples), None)
    return {"records": records, "evolution": buckets,
            "heartRate": ({"activityId": str(latest.id), "date": latest.created_at.isoformat(),
                           **(heart_summary(latest.heart_rate_samples, latest.heart_rate_max_bpm) or {})} if latest else None)}
