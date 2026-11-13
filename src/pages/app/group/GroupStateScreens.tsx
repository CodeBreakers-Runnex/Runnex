// Telas de carregando, erro e grupo não encontrado (antes dentro de Group.tsx).
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

export function LoadingScreen() {
  return (
    <div className="app-shell flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-purple-500" size={40} />
      <p className="text-[10px] font-black text-muted-foreground tracking-[0.2em] uppercase">Carregando grupo...</p>
    </div>
  );
}

export function StateScreen({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionLoading,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionLoading?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <div className="app-shell flex flex-col items-center justify-center gap-5 px-6 text-center safe-top">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-500">
        {icon}
      </div>
      <div>
        <p className="font-display text-xl font-black uppercase tracking-tighter">{title}</p>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/social")}
          className="rounded-xl border border-border bg-card px-6 py-3 text-xs font-black uppercase tracking-widest text-foreground/80"
        >
          Voltar aos grupos
        </button>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            disabled={actionLoading}
            className="flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 transition px-6 py-3 text-xs font-black uppercase tracking-widest text-white disabled:opacity-60"
          >
            {actionLoading && <Loader2 size={14} className="animate-spin" />}
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
