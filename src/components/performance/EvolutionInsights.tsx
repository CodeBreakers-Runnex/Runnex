import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { formatDuration } from "@/lib/performance";
import { usePerformanceSummary } from "@/hooks/usePerformanceSummary";
import PerformanceState from "./PerformanceState";
const date = (iso: string) => new Date(iso.includes("T") ? iso : `${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
function change(current: number, previous: number) {
  if (!previous) return current ? "Sem base anterior" : "Sem variação";
  const percent = (current - previous) / previous * 100;
  return `${percent > 0 ? "+" : ""}${percent.toFixed(1)}%`;
}
export default function EvolutionInsights({ userId }: { userId: string }) {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const { data, error, retry } = usePerformanceSummary(userId);
  if (!data || error) return <PerformanceState error={error} retry={retry} />;
  const periods = data.evolution[period];
  const current = periods.at(-1);
  const previous = periods.at(-2);
  const maxKm = Math.max(1, ...periods.map(p => p.km));
  if (!current || !previous) return <p className="mx-6 mt-8">Ainda não há períodos suficientes para comparar.</p>;
  return <section className="mx-6 mt-8 rounded-3xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-bold"><TrendingUp size={18} className="text-purple-400" />Evolução do corredor</h3>
        <div className="flex gap-2">{(["week", "month"] as const).map(value => <button key={value} aria-pressed={period === value} onClick={() => setPeriod(value)} className={`rounded-xl px-3 py-2 text-xs ${period === value ? "bg-purple-600 text-white" : "bg-secondary"}`}>{value === "week" ? "Semanas" : "Meses"}</button>)}</div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{period === "week" ? "Semana atual em andamento versus semana anterior completa." : "Mês atual em andamento versus mês anterior completo."} Pace ponderado pela distância; menor é mais rápido.</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-secondary/50 p-4"><p className="text-xs text-muted-foreground">Volume atual</p><p className="font-black text-xl">{current.km.toFixed(2)} km</p><p className="text-xs text-purple-400">{change(current.km, previous.km)} · anterior: {previous.km.toFixed(2)} km</p></div>
        <div className="rounded-2xl bg-secondary/50 p-4"><p className="text-xs text-muted-foreground">Pace atual</p><p className="font-black text-xl">{current.paceSecondsPerKm === null ? "—" : `${formatDuration(current.paceSecondsPerKm)}/km`}</p><p className="text-xs text-purple-400">{current.paceSecondsPerKm === null || previous.paceSecondsPerKm === null ? "Sem comparação" : `${change(current.paceSecondsPerKm, previous.paceSecondsPerKm)} · anterior: ${formatDuration(previous.paceSecondsPerKm)}/km`}</p></div>
      </div>
      <div className="mt-5 space-y-3" aria-label="Histórico de volume e pace">{periods.map(p => <div key={p.start}>
        <div className="flex justify-between gap-2 text-xs"><span>{date(p.start)}{p.inProgress ? " · atual" : ""}</span><span>{p.km.toFixed(2)} km · {p.runs} corridas · {p.paceSecondsPerKm === null ? "—" : `${formatDuration(p.paceSecondsPerKm)}/km`}</span></div>
        <div className="mt-1 h-2 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-purple-500 rounded-full" style={{ width: `${p.km / maxKm * 100}%` }} /></div>
      </div>)}</div>
    </section>;
}
