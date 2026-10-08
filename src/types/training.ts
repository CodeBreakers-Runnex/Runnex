export type WorkoutCategory = "easy" | "interval" | "long" | "tempo" | "walk" | "other" | "rest";
export type WorkoutStatus = "planned" | "completed" | "skipped" | "cancelled";

export interface WorkoutInput {
  title: string;
  category: WorkoutCategory;
  notes: string | null;
  plannedDate: string;
  plannedTime: string | null;
  timezone: string;
  targetDistanceKm: number | null;
  targetDurationMinutes: number | null;
}

export interface Workout extends WorkoutInput {
  id: number;
  originalDate: string;
  scheduledAt: string | null;
  status: WorkoutStatus;
  completionSource: "manual" | "activity" | null;
  completedAt: string | null;
  completedActivityId: number | null;
  evidenceRemoved: boolean;
  revision: number;
  overdue: boolean;
  activity: { id: number; distance: number; durationSeconds: number; pace: string; recordedAt: string } | null;
}

export interface TrainingSummary {
  week: string;
  end: string;
  timezone: string;
  plannedCount: number;
  completedCount: number;
  manualCount: number;
  skippedCount: number;
  restCount: number;
  targetKm: number;
  targetMinutes: number;
  recordedKm: number;
  recordedMinutes: number;
  runCount: number;
  closed: boolean;
  completionRate: number | null;
}
