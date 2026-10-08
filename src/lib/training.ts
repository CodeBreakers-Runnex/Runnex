import { addDays, format, startOfMonth, startOfWeek } from "date-fns";
import type { Workout, WorkoutCategory, WorkoutStatus } from "@/types/training";

export const CATEGORY_LABELS: Record<WorkoutCategory, string> = { easy: "Corrida leve", interval: "Intervalado", long: "Longo", tempo: "Ritmo", walk: "Caminhada", other: "Outro", rest: "Descanso" };
export const STATUS_LABELS: Record<WorkoutStatus, string> = { planned: "Planejado", completed: "Concluído", skipped: "Não realizado", cancelled: "Cancelado" };
export const dayKey = (date: Date) => format(date, "yyyy-MM-dd");
export const parseDay = (day: string) => new Date(day + "T12:00:00");
export const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
export const formatDay = (day: string) => parseDay(day).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
export const weekStart = (day: string) => dayKey(startOfWeek(parseDay(day), { weekStartsOn: 1 }));
export function calendarDays(day: string, view: "month" | "week" | "list") {
  const base = parseDay(day);
  const start = view === "week" ? startOfWeek(base, { weekStartsOn: 1 }) : startOfWeek(startOfMonth(base), { weekStartsOn: 1 });
  return Array.from({ length: view === "week" ? 7 : 42 }, (_, i) => dayKey(addDays(start, i)));
}
export const workoutLabel = (workout: Workout) => workout.overdue && workout.status === "planned" ? "Pendente" : STATUS_LABELS[workout.status];
export function currentZoneSchedule(workout: Workout): string | null {
  if (!workout.scheduledAt || workout.timezone === localZone()) return null;
  return new Date(workout.scheduledAt).toLocaleString("pt-BR", { timeZone: localZone(), day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
