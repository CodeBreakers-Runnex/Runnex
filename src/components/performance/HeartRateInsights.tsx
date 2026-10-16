import { Heart } from "lucide-react";
import { formatDuration } from "@/lib/performance";
import { usePerformanceSummary } from "@/hooks/usePerformanceSummary";
import PerformanceState from "./PerformanceState";
const date = (iso: string) => new Date(iso.includes("T") ? iso : `${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
export default function HeartRateInsights({ userId }: { userId: string }) {
  const { data, error, retry } = usePerformanceSummary(userId);
  if (!data || error) return <PerformanceState error={error} retry={retry} />;
  const heart = data.heartRate;
  return <section className="mx-6 mt-8 rounded-3xl border border-border bg-card p-6">
      <h3 className="flex items-center gap-2 font-bold"><Heart size={18} className="text-purple-400" />Zonas cardíacas</h3>
      {!heart ? <p className="mt-3 text-sm text-muted-foreground">Nenhuma medição ainda. Conecte um sensor cardíaco Bluetooth na tela de corrida. O GPS sozinho não mede seus batimentos.</p> : <>
        <p className="mt-2 text-xs text-muted-foreground">Última corrida com sensor · {date(heart.date)} · referência: {heart.referenceMaxBpm} bpm</p>
        <div className="mt-4 flex gap-6"><p><strong className="text-xl">{heart.averageBpm ?? "—"}</strong><span className="block text-xs text-muted-foreground">FC média · bpm</span></p><p><strong className="text-xl">{heart.maxBpm}</strong><span className="block text-xs text-muted-foreground">FC máxima medida · bpm</span></p></div>
        <div className="mt-5 space-y-3">{heart.zones.map(z => <div key={z.zone}><div className="flex justify-between text-xs"><span>Z{z.zone} · {40 + z.zone * 10}–{z.zone === 5 ? "100%+" : `${50 + z.zone * 10}%`}</span><span>{formatDuration(z.seconds)}</span></div><div className="mt-1 h-2 rounded-full bg-secondary overflow-hidden"><div className="h-full rounded-full bg-purple-500" style={{ width: `${heart.coveredSeconds ? z.seconds / heart.coveredSeconds * 100 : 0}%` }} /></div></div>)}</div>
        <p className="mt-3 text-xs text-muted-foreground">Tempo medido: {formatDuration(heart.coveredSeconds)} · abaixo de Z1: {formatDuration(heart.belowZoneSeconds)}. Lacunas do sensor não entram nos totais.</p>
      </>}
    </section>;
}
