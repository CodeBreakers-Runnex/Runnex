import { auth } from "@/config/firebase";
import { getWorkout, linkWorkoutActivity } from "@/services/trainingApi";
import type { Workout } from "@/types/training";

const checkAccount = (uid: string) => { if (auth.currentUser?.uid !== uid) throw new Error("A conta mudou. Abra a agenda na conta da corrida para vinculá-la."); };
export async function loadPlannedRun(uid: string, workoutId: number): Promise<Workout> {
  checkAccount(uid);
  const workout = await getWorkout(workoutId);
  checkAccount(uid);
  if (workout.status !== "planned" || workout.category === "rest") throw new Error("Esse treino não está disponível para iniciar uma corrida. Confira a agenda.");
  return workout;
}
export async function completePlannedRun(uid: string, workout: Workout, activityId: number): Promise<void> {
  checkAccount(uid);
  await linkWorkoutActivity(workout, activityId);
  checkAccount(uid);
}
