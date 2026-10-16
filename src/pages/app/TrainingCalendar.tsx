import { useCallback, useEffect, useRef, useState } from "react";
import { addDays, addMonths } from "date-fns";
import { useNavigate } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getUserActivities } from "@/services/database";
import { createWorkout, deleteWorkout, getTrainingSummary, getWorkouts, linkWorkoutActivity, setWorkoutStatus, updateWorkout } from "@/services/trainingApi";
import { calendarDays, CATEGORY_LABELS, dayKey, formatDay, localZone, parseDay, weekStart, workoutLabel } from "@/lib/training";
import { selectPlannedRun } from "@/lib/trainingRunSelection";
import TrainingCalendarView from "@/components/training/TrainingCalendarView";
import TrainingDialog from "@/components/training/TrainingDialog";
import WorkoutForm from "@/components/training/WorkoutForm";
import WorkoutDetails from "@/components/training/WorkoutDetails";
import type { FeedActivity } from "@/types";
import type { TrainingSummary, Workout, WorkoutInput } from "@/types/training";

type LoadedAgenda = { uid: string; workouts: Workout[]; activities: FeedActivity[]; summary: TrainingSummary };
type FormState = { uid: string | undefined; workout?: Workout; copy?: boolean; day: string };
const buttonClass = "rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold disabled:opacity-50";

export default function TrainingCalendar() {
  const { user } = useAuth();
  const uid = user?.uid;
  const scopeRef = useRef(uid);
  scopeRef.current = uid;
  const navigate = useNavigate();
  const [day, setDay] = useState(() => dayKey(new Date()));
  const [view, setView] = useState<"month" | "week" | "list">("month");
  const [data, setData] = useState<LoadedAgenda | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const operationRef = useRef<symbol | null>(null);
  const requests = useRef(0);
  const [refresh, setRefresh] = useState(0);
  const [form, setForm] = useState<FormState | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const days = calendarDays(day, view);
  const start = days[0], end = days[days.length - 1];
  const monday = weekStart(day);
  const load = useCallback(async () => {
    if (!uid) return;
    const request = ++requests.current;
    setLoading(true); setLoadError("");
    try {
      const [workouts, summary, activities] = await Promise.all([getWorkouts(start, end), getTrainingSummary(monday, localZone()), getUserActivities(uid, 100)]);
      if (request === requests.current && scopeRef.current === uid) setData({ uid, workouts, summary, activities });
    } catch (e) { if (request === requests.current && scopeRef.current === uid) setLoadError(e instanceof Error ? e.message : "Não foi possível carregar a agenda."); }
    finally { if (request === requests.current && scopeRef.current === uid) setLoading(false); }
  }, [uid, start, end, monday]);
  const invalidateRequests = useCallback(() => { requests.current++; }, []);
  useEffect(() => { void load(); return invalidateRequests; }, [load, refresh, invalidateRequests]);
  useEffect(() => { const focus = () => { if (!busyRef.current) void load(); }; window.addEventListener("focus", focus); return () => window.removeEventListener("focus", focus); }, [load]);
  useEffect(() => { setForm(null); setSelectedId(null); setConfirmDelete(false); setBusy(false); busyRef.current = false; operationRef.current = null; }, [uid]);
  const agenda = data?.uid === uid ? data : null;
  const workouts = agenda?.workouts ?? [];
  const selected = workouts.find(w => w.id === selectedId);
  const summary = agenda?.summary;

  async function perform<T>(task: () => Promise<T>, success?: (value: T) => void): Promise<T> {
    if (!uid || busyRef.current) throw new Error("Aguarde a operação atual.");
    const scope = uid;
    const operation = Symbol();
    operationRef.current = operation;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const result = await task();
      if (scopeRef.current === scope && operationRef.current === operation) { success?.(result); setRefresh(n => n + 1); }
      return result;
    } catch (e) {
      if (scopeRef.current === scope && operationRef.current === operation) { setError(e instanceof Error ? e.message : "Não foi possível atualizar o treino."); setRefresh(n => n + 1); }
      throw e;
    } finally { if (operationRef.current === operation) { operationRef.current = null; busyRef.current = false; setBusy(false); } }
  }
  const runAction = (task: () => Promise<unknown>, success?: () => void) => { void perform(task, success).catch(() => undefined); };
  const save = async (input: WorkoutInput) => {
    if (!uid || form?.uid !== uid) throw new Error("A conta mudou. Abra novamente o formulário.");
    await perform(() => form?.workout && !form.copy ? updateWorkout(form.workout, input) : createWorkout(input), saved => { setForm(null); setDay(saved.plannedDate); setSelectedId(saved.id); });
  };
  const move = (direction: number) => setDay(dayKey(view === "week" ? addDays(parseDay(day), direction * 7) : addMonths(parseDay(day), direction)));
  const visible = view === "list" ? workouts.filter(w => w.plannedDate.slice(0, 7) === day.slice(0, 7)) : workouts.filter(w => w.plannedDate === day);
  const startRun = () => {
    if (!uid || !selected) return;
    try { selectPlannedRun(uid, selected.id); navigate("/run"); }
    catch { setError("Não foi possível guardar a seleção. Verifique o armazenamento do app e tente novamente."); }
  };

  return <div className="app-shell pb-28 safe-top">
    <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border bg-card/90 px-5 py-4 backdrop-blur-xl"><div className="flex items-center gap-3"><CalendarDays className="shrink-0 text-primary" /><h1 className="text-xl font-black">Calendário de treinos</h1></div><button className="rounded-xl bg-primary p-3 text-primary-foreground disabled:opacity-50" disabled={busy} aria-label="Adicionar treino" onClick={() => setForm({ uid, day })}><Plus size={20} /></button></header>
    <main className="space-y-5 px-4 py-5 sm:px-6">
      <p className="text-sm text-muted-foreground">Organize seus próximos treinos e acompanhe o que realizou.</p>
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2">{(["month", "week", "list"] as const).map(mode => <button key={mode} className={`${buttonClass} ${view === mode ? "border-primary text-primary" : ""}`} aria-pressed={view === mode} disabled={busy} onClick={() => setView(mode)}>{mode === "month" ? "Mês" : mode === "week" ? "Semana" : "Lista"}</button>)}</div><button className={buttonClass} disabled={busy} onClick={() => setDay(dayKey(new Date()))}>Hoje</button></div>
      <div className="flex items-center justify-between gap-2"><button className={buttonClass} aria-label="Período anterior" disabled={busy} onClick={() => move(-1)}><ChevronLeft size={18} /></button><h2 className="text-center text-sm font-bold capitalize">{view === "week" ? `${formatDay(start)} — ${formatDay(end)}` : parseDay(day).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h2><button className={buttonClass} aria-label="Próximo período" disabled={busy} onClick={() => move(1)}><ChevronRight size={18} /></button></div>
      {(error || loadError) && <div role="alert" className="rounded-2xl border border-destructive/30 p-4 text-sm"><p>{error || loadError}</p><button className={`${buttonClass} mt-2`} onClick={() => { setError(""); void load(); }}>Tentar novamente</button></div>}
      {loading && <p role="status" className="text-sm text-muted-foreground">Carregando agenda…</p>}
      {view !== "list" && <TrainingCalendarView days={days} selectedDay={day} workouts={workouts} onDay={next => { if (!busy) setDay(next); }} />}
      <section aria-label="Treinos da agenda" className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-black">{view === "list" ? "Agenda do mês" : formatDay(day)}</h2><button className={buttonClass} disabled={busy} onClick={() => setForm({ uid, day })}>Novo treino</button></div>
        {!loading && !visible.length && !error && !loadError && <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">Nenhum treino planejado neste período. Adicione uma corrida ou um dia de descanso.</p>}
        {visible.map(w => <button key={w.id} onClick={() => { setSelectedId(w.id); setConfirmDelete(false); }} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-left"><div className="min-w-0"><p className="truncate font-bold">{w.title}</p><p className="mt-1 text-xs text-muted-foreground">{view === "list" && `${formatDay(w.plannedDate)} · `}{CATEGORY_LABELS[w.category]}{w.plannedTime ? ` · ${w.plannedTime.slice(0, 5)}` : ""}</p></div><span className={`shrink-0 rounded-lg px-2 py-1 text-xs ${w.status === "completed" ? "bg-emerald-500/10 text-emerald-500" : w.overdue ? "bg-amber-500/10 text-amber-500" : "bg-primary/10 text-primary"}`}>{workoutLabel(w)}</span></button>)}
      </section>
      {summary && <section aria-label="Resumo semanal" className="rounded-2xl border border-border bg-card p-5"><h2 className="font-black">Semana de {formatDay(summary.week)}</h2><div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><p><strong>{summary.plannedCount}</strong> treinos previstos</p><p><strong>{summary.completedCount}</strong> concluídos</p><p><strong>{summary.skippedCount}</strong> não realizados</p><p><strong>{summary.restCount}</strong> descansos</p></div><div className="mt-4 grid gap-2 border-t border-border pt-4 text-sm sm:grid-cols-2"><p>Volume planejado: <strong>{summary.targetKm} km · {summary.targetMinutes} min</strong></p><p>Corridas registradas: <strong>{summary.recordedKm} km · {summary.recordedMinutes} min</strong></p></div><p className="mt-3 text-xs text-muted-foreground">{summary.manualCount} conclusões por autorrelato. {summary.closed ? summary.completionRate == null ? "Semana sem treinos elegíveis." : `Cumprimento da agenda: ${summary.completionRate}%.` : "Semana em andamento."} Volume real considera as corridas pela data de registro, no fuso {summary.timezone}.</p></section>}
      <p className="text-xs text-muted-foreground">Sua agenda é privada. Planejamento e conclusão manual não adicionam quilômetros ou XP.</p>
    </main>
    {form?.uid === uid && form && <TrainingDialog title={form.copy ? "Copiar treino" : form.workout ? "Editar / reagendar" : "Novo treino"} onClose={() => setForm(null)} busy={busy}><WorkoutForm initial={form.workout} copy={form.copy} day={form.day} onSave={save} /></TrainingDialog>}
    {!form && selected && <TrainingDialog title={confirmDelete ? "Excluir planejamento" : selected.title} busy={busy} onClose={() => { setSelectedId(null); setConfirmDelete(false); }}>
      {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
      {confirmDelete ? <div className="space-y-4"><p className="text-sm">Excluir “{selected.title}” da agenda? A corrida registrada será preservada.</p><div className="flex gap-2"><button className={buttonClass} disabled={busy} onClick={() => setConfirmDelete(false)}>Voltar</button><button className={`${buttonClass} text-destructive`} disabled={busy} onClick={() => runAction(() => deleteWorkout(selected), () => { setSelectedId(null); setConfirmDelete(false); })}>Confirmar exclusão</button></div></div> : <WorkoutDetails workout={selected} activities={agenda?.activities ?? []} busy={busy} onEdit={() => setForm({ uid, workout: selected, day: selected.plannedDate })} onCopy={() => setForm({ uid, workout: selected, copy: true, day: dayKey(addDays(parseDay(selected.plannedDate), 1)) })} onDelete={() => setConfirmDelete(true)} onStart={startRun} onStatus={status => runAction(() => setWorkoutStatus(selected, status))} onLink={id => runAction(() => linkWorkoutActivity(selected, id))} />}
    </TrainingDialog>}
  </div>;
}
