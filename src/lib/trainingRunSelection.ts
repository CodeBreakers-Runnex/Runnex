const KEY = "runnex_planned_run_v1";
export interface PlannedRunSelection { uid: string; workoutId: number; }

export function getPlannedRun(uid: string): PlannedRunSelection | null {
  try {
    const item = JSON.parse(localStorage.getItem(KEY) || "null") as PlannedRunSelection | null;
    return item?.uid === uid && Number.isInteger(item.workoutId) && item.workoutId > 0 ? item : null;
  } catch { return null; }
}
export function selectPlannedRun(uid: string, workoutId: number) {
  localStorage.setItem(KEY, JSON.stringify({ uid, workoutId }));
}
export function clearPlannedRun(uid: string, workoutId?: number) {
  const selection = getPlannedRun(uid);
  if (selection && (workoutId === undefined || selection.workoutId === workoutId)) localStorage.removeItem(KEY);
}
