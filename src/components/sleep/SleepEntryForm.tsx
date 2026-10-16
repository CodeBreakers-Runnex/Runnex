import { useState } from "react";
import type { FormEvent } from "react";
import { Loader2, X } from "lucide-react";
import { localDateTimeValue } from "@/lib/sleep";
import type { SleepInput, SleepSession } from "@/types/sleep";

const field = "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm";

export default function SleepEntryForm({ record, busy, onSave, onClose }: {
  record: SleepSession | null;
  busy: boolean;
  onSave: (input: SleepInput) => Promise<void>;
  onClose: () => void;
}) {
  const [start, setStart] = useState(record ? localDateTimeValue(record.startTime) : "");
  const [end, setEnd] = useState(record ? localDateTimeValue(record.endTime) : "");
  const [hours, setHours] = useState(record?.sleepSeconds != null ? String(record.sleepSeconds / 3600) : "");
  const [kind, setKind] = useState<"main" | "nap">(record?.kind ?? "main");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const startTime = new Date(start);
    const endTime = new Date(end);
    const sleepSeconds = hours.trim() ? Math.round(Number(hours) * 3600) : null;
    if (!Number.isFinite(startTime.getTime()) || !Number.isFinite(endTime.getTime()) || endTime <= startTime) {
      setError("Informe horários válidos, com o fim após o início.");
      return;
    }
    if (sleepSeconds !== null && (!Number.isFinite(sleepSeconds) || sleepSeconds < 0 || sleepSeconds > (endTime.getTime() - startTime.getTime()) / 1000)) {
      setError("O tempo dormido deve caber dentro do período registrado.");
      return;
    }
    setError("");
    await onSave({ startTime: startTime.toISOString(), endTime: endTime.toISOString(), sleepSeconds, kind, endOffsetMinutes: -endTime.getTimezoneOffset() });
  }

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="sleep-form-title" className="max-h-[90svh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <h2 id="sleep-form-title" className="text-xl font-black">{record ? "Editar sono" : "Registrar sono"}</h2>
          <button aria-label="Fechar registro de sono" type="button" disabled={busy} onClick={onClose} className="rounded-lg p-2 hover:bg-secondary"><X size={20} /></button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Informe um período já concluído. O registro manual terá prioridade no resumo deste dia.</p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <label className="block text-sm font-bold">Início do sono<input className={field} type="datetime-local" required value={start} onChange={e => setStart(e.target.value)} /></label>
          <label className="block text-sm font-bold">Fim do sono<input className={field} type="datetime-local" required value={end} onChange={e => setEnd(e.target.value)} /></label>
          <label className="block text-sm font-bold">Tempo dormido, em horas (opcional)<input className={field} type="number" min="0" max="36" step="any" placeholder="Ex.: 6,5" value={hours} onChange={e => setHours(e.target.value)} /></label>
          <p className="text-xs text-muted-foreground">Desconte o tempo em que ficou acordado. Sem esta informação, mostraremos apenas o período registrado.</p>
          <label className="block text-sm font-bold">Tipo de sono<select className={field} value={kind} onChange={e => setKind(e.target.value as "main" | "nap")}><option value="main">Sono principal</option><option value="nap">Cochilo</option></select></label>
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground disabled:opacity-50">{busy && <Loader2 size={16} className="animate-spin" />}Salvar sono</button>
        </form>
      </section>
    </div>
  );
}
