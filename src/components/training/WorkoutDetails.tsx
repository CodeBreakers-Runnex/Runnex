import { useState } from "react";
import { CATEGORY_LABELS, currentZoneSchedule, formatDay, workoutLabel } from "@/lib/training";
import type { FeedActivity } from "@/types";
import type { Workout, WorkoutStatus } from "@/types/training";
import { toDateSafe } from "@/lib/feed-utils";

type Props = { workout: Workout; activities: FeedActivity[]; busy: boolean; onEdit: () => void; onCopy: () => void; onDelete: () => void; onStart: () => void; onStatus: (status: WorkoutStatus) => void; onLink: (activityId: number) => void };
const buttonClass = "rounded-xl border border-border px-3 py-2 text-sm font-bold disabled:opacity-50";
export default function WorkoutDetails({ workout: w, activities, busy, onEdit, onCopy, onDelete, onStart, onStatus, onLink }: Props) {
  const [activityId, setActivityId] = useState("");
  const converted = currentZoneSchedule(w);
  return <div className="space-y-4">
    <p className="text-sm font-bold text-primary">{CATEGORY_LABELS[w.category]} · {workoutLabel(w)}</p>
    <p className="text-sm">{formatDay(w.plannedDate)}{w.plannedTime ? ` às ${w.plannedTime.slice(0, 5)}` : " · sem horário"}<span className="mt-1 block text-xs text-muted-foreground">Fuso: {w.timezone}</span></p>
    {converted && <p className="text-xs text-muted-foreground">No fuso deste aparelho: {converted} ({Intl.DateTimeFormat().resolvedOptions().timeZone})</p>}
    {w.originalDate !== w.plannedDate && <p className="text-xs text-muted-foreground">Reagendado de {formatDay(w.originalDate)}</p>}
    {w.notes && <p className="whitespace-pre-wrap break-words text-sm">{w.notes}</p>}
    {w.evidenceRemoved && <p className="rounded-xl bg-amber-500/10 p-3 text-sm">A corrida vinculada foi apagada. Este treino voltou a ficar planejado.</p>}
    {w.category !== "rest" && <div className="rounded-xl bg-background p-3 text-sm"><p className="font-bold">Planejado</p><p>{w.targetDistanceKm == null ? "Distância livre" : `${w.targetDistanceKm} km`} · {w.targetDurationMinutes == null ? "Duração livre" : `${w.targetDurationMinutes} min`}</p>
      {w.activity && <div className="mt-3 border-t border-border pt-3"><p className="font-bold">Corrida registrada</p><p>{w.activity.distance} km · {(w.activity.durationSeconds / 60).toFixed(1)} min · pace {w.activity.pace}/km</p><p className="mt-1 text-xs text-muted-foreground">Registro: {new Date(w.activity.recordedAt).toLocaleString("pt-BR")}</p>{w.targetDistanceKm != null && <p className="mt-2">Diferença de distância: {(w.activity.distance - w.targetDistanceKm).toFixed(2)} km</p>}{w.targetDurationMinutes != null && <p>Diferença de duração: {(w.activity.durationSeconds / 60 - w.targetDurationMinutes).toFixed(1)} min</p>}</div>}
      {w.completionSource === "manual" && <p className="mt-3 text-xs text-muted-foreground">Conclusão manual (autorrelato). Sem corrida vinculada ou quilômetros adicionados.</p>}
    </div>}
    <fieldset disabled={busy} className="space-y-3">
      {w.status === "planned" ? <>
        {w.category !== "rest" && <button type="button" onClick={onStart} className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground">Iniciar corrida</button>}
        <div className="flex flex-wrap gap-2"><button className={buttonClass} onClick={onEdit}>Editar / reagendar</button><button className={buttonClass} onClick={() => onStatus("completed")}>{w.category === "rest" ? "Confirmar descanso" : "Concluir manualmente"}</button><button className={buttonClass} onClick={() => onStatus("skipped")}>Não realizado</button><button className={buttonClass} onClick={() => onStatus("cancelled")}>Cancelar treino</button></div>
        {w.category !== "rest" && <div className="rounded-xl border border-border p-3"><label className="block text-sm font-bold">Vincular corrida salva<select value={activityId} onChange={e => setActivityId(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background p-2 text-sm"><option value="">Selecione uma corrida</option>{activities.map(a => <option key={a.id} value={a.id}>{a.distance} km · {a.time} · {toDateSafe(a.timestamp)?.toLocaleString("pt-BR") ?? "Sem data"}</option>)}</select></label><p className="mt-1 text-xs text-muted-foreground">Até 100 corridas mais recentes da sua conta.</p><button className={`${buttonClass} mt-2`} disabled={!activityId || busy} onClick={() => onLink(Number(activityId))}>Vincular e concluir</button></div>}
      </> : <button className={buttonClass} onClick={() => onStatus("planned")}>Reabrir treino</button>}
      <div className="flex gap-2"><button className={buttonClass} onClick={onCopy}>Copiar para outra data</button><button className={`${buttonClass} text-destructive`} onClick={onDelete}>Excluir planejamento</button></div>
    </fieldset>
  </div>;
}
