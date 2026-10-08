import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getNextWorkout } from "@/services/trainingApi";
import { CATEGORY_LABELS, formatDay } from "@/lib/training";
import type { Workout } from "@/types/training";

export default function NextWorkoutCard() {
  const { user } = useAuth();
  const uid = user?.uid;
  const [data, setData] = useState<{ uid: string; workout: Workout | null } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!uid) return;
    let live = true;
    setFailed(false);
    const load = () => { void getNextWorkout().then(workout => { if (live) setData({ uid, workout }); }).catch(() => { if (live) setFailed(true); }); };
    load(); window.addEventListener("focus", load);
    return () => { live = false; window.removeEventListener("focus", load); };
  }, [uid]);
  const workout = data?.uid === user?.uid ? data?.workout : null;
  return <Link to="/calendario-treinos" className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-card p-4"><CalendarDays className="shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="text-sm font-black">{workout ? "Próximo treino" : "Calendário de treinos"}</p><p className="mt-1 truncate text-xs text-muted-foreground">{failed ? "Abra a agenda para tentar carregar seus treinos." : workout ? `${workout.title} · ${formatDay(workout.plannedDate)}${workout.plannedTime ? ` às ${workout.plannedTime.slice(0, 5)}` : ""} · ${CATEGORY_LABELS[workout.category]}` : "Planeje suas corridas e dias de descanso"}</p></div><ChevronRight size={18} /></Link>;
}
