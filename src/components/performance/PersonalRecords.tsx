import { Trophy } from "lucide-react";
import { formatDuration } from "@/lib/performance";
import { usePerformanceSummary } from "@/hooks/usePerformanceSummary";
import PerformanceState from "./PerformanceState";
const date = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
export default function PersonalRecords({ userId }: { userId: string }) {
  const { data, error, retry } = usePerformanceSummary(userId);
  if (!data || error) return <PerformanceState error={error} retry={retry} />;
  return <section className="mx-6 mt-8 rounded-3xl border border-border bg-card p-6">
      <h3 className="flex items-center gap-2 font-bold"><Trophy size={18} className="text-purple-400" />Recordes pessoais</h3>
      <p className="mt-2 text-xs text-muted-foreground">Melhores trechos contínuos, estimados entre as amostras de tempo e distância. Corridas antigas sem esses dados não geram recordes de trecho.</p>
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">{data.records.map(record => <div key={record.label} className="rounded-2xl bg-secondary/50 p-4">
        <p className="text-xs text-muted-foreground">{record.label}</p><p className="mt-1 text-xl font-black text-purple-400">{record.best ? formatDuration(record.best.durationSeconds) : "—"}</p>
        <p className="mt-1 text-xs text-muted-foreground">{record.best ? date(record.best.date) : "Ainda sem registro"}</p>
      </div>)}</div>
    </section>;
}
