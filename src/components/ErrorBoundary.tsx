import { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center bg-card border border-red-500/30 p-8 rounded-3xl w-full max-w-sm"
          >
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
              <AlertCircle size={32} className="text-red-500" />
            </div>
            <h1 className="font-display font-black text-2xl italic tracking-tight mb-2">Ops, algo deu errado.</h1>
            <p className="text-muted-foreground text-sm mb-6 max-w-[250px]">
              Tivemos um problema inesperado ao renderizar essa página. Nossa equipe foi notificada (mentira, é só um app, mas o erro tá guardado).
            </p>
            
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 bg-foreground text-background px-6 py-3 rounded-full font-bold active:scale-95 transition-transform"
            >
              <RefreshCw size={16} />
              Tentar Novamente
            </button>
            <div className="mt-6 text-[10px] uppercase text-muted-foreground/70 font-mono break-all text-left w-full h-24 overflow-y-auto bg-background p-3 rounded-xl border border-border">
              {this.state.error?.message || "Unknown Error"}
            </div>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}
