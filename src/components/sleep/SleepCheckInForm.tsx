import { useState } from "react";
import type { FormEvent } from "react";
import type { SleepCheckIn } from "@/types/sleep";

export default function SleepCheckInForm({ value, busy, onSave }: {
  value: SleepCheckIn | null;
  busy: boolean;
  onSave: (input: { quality: number | null; fatigue: number | null }) => Promise<void>;
}) {
  const [quality, setQuality] = useState(value?.quality ? String(value.quality) : "");
  const [fatigue, setFatigue] = useState(value?.fatigue ? String(value.fatigue) : "");
  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSave({ quality: quality ? Number(quality) : null, fatigue: fatigue ? Number(fatigue) : null });
  }
  const inputClass = "mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm";
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">Como foi seu sono?<select className={inputClass} value={quality} onChange={e => setQuality(e.target.value)}><option value="">Não informar</option><option value="1">1 — Muito ruim</option><option value="2">2 — Ruim</option><option value="3">3 — Regular</option><option value="4">4 — Bom</option><option value="5">5 — Muito bom</option></select></label>
        <label className="text-sm font-bold">Como está seu cansaço?<select className={inputClass} value={fatigue} onChange={e => setFatigue(e.target.value)}><option value="">Não informar</option><option value="1">1 — Muito baixo</option><option value="2">2 — Baixo</option><option value="3">3 — Moderado</option><option value="4">4 — Alto</option><option value="5">5 — Muito alto</option></select></label>
      </div>
      <button disabled={busy || (!quality && !fatigue)} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">Salvar check-in</button>
    </form>
  );
}
