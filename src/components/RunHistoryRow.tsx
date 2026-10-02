import { Timer, BarChart3, Flame, Trash2, Loader2 } from "lucide-react";
import type { FeedActivity } from "@/types";

export interface RunHistoryRowProps {
  run: FeedActivity;
  dateLabel: string;
  /** Se informado, data e distância viram botões que navegam para os detalhes. */
  onSelect?: () => void;
  /** Se informado, mostra o botão de apagar (com o padrão de confirmação em dois toques do app). */
  onDelete?: () => void;
  deleting?: boolean;
  confirmDelete?: boolean;
}

const RunHistoryRow = ({ run, dateLabel, onSelect, onDelete, deleting = false, confirmDelete = false }: RunHistoryRowProps) => {
  const stats = [
    { label: "Pace", value: run.pace, icon: Timer },
    { label: "Tempo", value: run.time, icon: BarChart3 },
    { label: "Kcal", value: (run.calories ?? 0).toString(), icon: Flame },
  ];

  return (
    <div
      className={`w-full rounded-2xl bg-card/80 backdrop-blur-xl border p-4 text-left transition ${
        confirmDelete ? "border-red-500/40 bg-red-500/5" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        {onSelect ? (
          <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">{dateLabel}</p>
            <p className="mt-1 font-display text-lg font-black italic text-foreground">Corrida</p>
          </button>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">{dateLabel}</p>
            <p className="mt-1 font-display text-lg font-black italic text-foreground">Corrida</p>
          </div>
        )}

        {onSelect ? (
          <button type="button" onClick={onSelect} className="text-right">
            <p className="font-display text-2xl font-black italic text-purple-400">{run.distance.toFixed(2)}</p>
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">km</p>
          </button>
        ) : (
          <div className="text-right">
            <p className="font-display text-2xl font-black italic text-purple-400">{run.distance.toFixed(2)}</p>
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">km</p>
          </div>
        )}

        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition active:scale-95 disabled:opacity-60 ${
              confirmDelete
                ? "border-red-500/50 bg-red-500/15 text-red-400"
                : "border-input bg-secondary text-muted-foreground hover:border-red-500/35 hover:text-red-400"
            }`}
            aria-label="Apagar corrida"
          >
            {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border/70 pt-4">
        {stats.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-muted-foreground">
            <item.icon size={13} className="text-purple-500" />
            <div>
              <p className="text-xs font-black">{item.value}</p>
              <p className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/70">{item.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RunHistoryRow;
