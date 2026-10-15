import { useState, type FormEvent } from "react";
import { CATEGORY_LABELS, localZone } from "@/lib/training";
import type { Workout, WorkoutCategory, WorkoutInput } from "@/types/training";

const inputClass = "mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm";
export default function WorkoutForm({ initial, day, copy = false, onSave }: { initial?: Workout; day: string; copy?: boolean; onSave: (input: WorkoutInput) => Promise<void> }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState<WorkoutCategory>(initial?.category ?? "easy");
  const [date, setDate] = useState(copy ? day : initial?.plannedDate ?? day);
  const [time, setTime] = useState(initial?.plannedTime?.slice(0, 5) ?? "");
  const [zone, setZone] = useState(initial?.timezone ?? localZone());
  const [distance, setDistance] = useState(initial?.targetDistanceKm?.toString() ?? "");
  const [duration, setDuration] = useState(initial?.targetDurationMinutes?.toString() ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!title.trim()) { setError("Informe o título do treino."); return; }
    setSaving(true); setError("");
    try { await onSave({ title: title.trim(), category, plannedDate: date, plannedTime: time || null, timezone: zone, targetDistanceKm: category === "rest" || !distance ? null : Number(distance), targetDurationMinutes: category === "rest" || !duration ? null : Number(duration), notes: notes.trim() || null }); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar o treino."); }
    finally { setSaving(false); }
  };
  return <form onSubmit={submit} className="space-y-4">
    <fieldset disabled={saving} className="space-y-4">
      <label className="block text-sm font-bold">Título<input autoFocus className={inputClass} value={title} onChange={e => setTitle(e.target.value)} maxLength={80} required /></label>
      <label className="block text-sm font-bold">Categoria<select className={inputClass} value={category} onChange={e => setCategory(e.target.value as WorkoutCategory)}>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <div className="grid grid-cols-2 gap-3"><label className="text-sm font-bold">Data<input className={inputClass} type="date" min="2000-01-01" max="2100-12-31" value={date} onChange={e => setDate(e.target.value)} required /></label><label className="text-sm font-bold">Horário (opcional)<input className={inputClass} type="time" value={time} onChange={e => setTime(e.target.value)} /></label></div>
      <label className="block text-sm font-bold">Fuso horário<input className={inputClass} value={zone} onChange={e => setZone(e.target.value)} maxLength={80} placeholder="America/Sao_Paulo" required /></label>
      {category !== "rest" && <div className="grid grid-cols-2 gap-3"><label className="text-sm font-bold">Meta (km)<input className={inputClass} type="number" min="0.01" max="500" step="0.01" value={distance} onChange={e => setDistance(e.target.value)} /></label><label className="text-sm font-bold">Meta (minutos)<input className={inputClass} type="number" min="1" max="1440" step="1" value={duration} onChange={e => setDuration(e.target.value)} /></label></div>}
      <label className="block text-sm font-bold">Observações<textarea className={inputClass} value={notes} onChange={e => setNotes(e.target.value)} maxLength={1000} rows={3} /></label>
      <p className="text-xs text-muted-foreground">As metas são opcionais e servem para comparar seu planejamento com a corrida realizada.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button type="submit" className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50">{saving ? "Salvando…" : "Salvar treino"}</button>
    </fieldset>
  </form>;
}
