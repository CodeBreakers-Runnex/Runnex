import { dayKey, parseDay, workoutLabel } from "@/lib/training";
import type { Workout } from "@/types/training";

export default function TrainingCalendarView({ days, selectedDay, workouts, onDay }: { days: string[]; selectedDay: string; workouts: Workout[]; onDay: (day: string) => void }) {
  const today = dayKey(new Date());
  return <div className="rounded-2xl border border-border bg-card p-2 sm:p-4">
    <div className="grid grid-cols-7 text-center text-xs font-bold text-muted-foreground">{["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"].map(day => <span className="py-2" key={day}>{day}</span>)}</div>
    <div className="grid grid-cols-7 gap-1">{days.map(day => {
      const entries = workouts.filter(w => w.plannedDate === day);
      return <button type="button" key={day} aria-pressed={selectedDay === day} aria-current={day === today ? "date" : undefined} aria-label={`${parseDay(day).toLocaleDateString("pt-BR")}, ${entries.length} treinos`} onClick={() => onDay(day)} className={`min-h-16 overflow-hidden rounded-xl border p-1 text-left sm:min-h-24 sm:p-2 ${selectedDay === day ? "border-primary bg-primary/10" : "border-border bg-background"}`}>
        <span className={`text-sm font-bold ${day === today ? "text-primary" : ""}`}>{parseDay(day).getDate()}</span>
        <div className="mt-1 flex flex-wrap gap-1" aria-hidden="true">{entries.slice(0, 3).map(w => <span key={w.id} title={`${w.title} — ${workoutLabel(w)}`} className={`h-2 w-2 rounded-full ${w.status === "completed" ? "bg-emerald-500" : w.status === "cancelled" ? "bg-muted-foreground" : w.overdue ? "bg-amber-500" : "bg-primary"}`} />)}</div>
        {entries.length > 0 && <span className="mt-1 block truncate text-[10px] text-muted-foreground">{entries.length} {entries.length === 1 ? "treino" : "treinos"}</span>}
      </button>;
    })}</div>
  </div>;
}
