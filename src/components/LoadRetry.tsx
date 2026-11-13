import { RefreshCw } from "lucide-react";

// Mensagem de "não carregou" com botão para tentar de novo, no lugar do
// carregando infinito. retryLabel diz ao leitor de tela o que será recarregado.
export default function LoadRetry({
  message,
  retryLabel,
  onRetry,
  className = "",
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={`flex flex-col items-center justify-center gap-3 text-center ${className}`}>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        aria-label={retryLabel}
        className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-purple-700"
      >
        <RefreshCw size={13} />
        Tentar de novo
      </button>
    </div>
  );
}
