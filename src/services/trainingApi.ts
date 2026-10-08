import { api } from "@/services/apiClient";
import type { TrainingSummary, Workout, WorkoutInput, WorkoutStatus } from "@/types/training";

export async function getWorkouts(start: string, end: string): Promise<Workout[]> {
  const items: Workout[] = [];
  let offset: number | null = 0;
  while (offset !== null) {
    const page: { items: Workout[]; nextOffset: number | null; total: number } = await api.get(`/training/workouts?from=${start}&to=${end}&offset=${offset}`);
    items.push(...page.items);
    if (items.length > 2000) throw new Error("Há muitos treinos nesse intervalo. Consulte uma semana de cada vez.");
    offset = page.nextOffset;
  }
  return items;
}
export const getWorkout = (id: number) => api.get<Workout>(`/training/workouts/${id}`);
export const getNextWorkout = () => api.get<Workout | null>("/training/next");
export const getTrainingSummary = (week: string, zone: string) => api.get<TrainingSummary>(`/training/summary?week=${week}&zone=${encodeURIComponent(zone)}`);
export const createWorkout = (input: WorkoutInput) => api.post<Workout>("/training/workouts", input);
export const updateWorkout = (workout: Workout, input: WorkoutInput) => api.patch<Workout>(`/training/workouts/${workout.id}`, { ...input, revision: workout.revision });
export const deleteWorkout = (workout: Workout) => api.delete<void>(`/training/workouts/${workout.id}?revision=${workout.revision}`);
export const setWorkoutStatus = (workout: Workout, status: WorkoutStatus) => api.put<Workout>(`/training/workouts/${workout.id}/status`, { status, revision: workout.revision });
export const linkWorkoutActivity = (workout: Pick<Workout, "id" | "revision">, activityId: number) => api.put<Workout>(`/training/workouts/${workout.id}/activity`, { activityId, revision: workout.revision });
