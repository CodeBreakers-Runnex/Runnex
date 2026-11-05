import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Loader2, ServerCrash } from "lucide-react";

import { ensureServerAwake, isServerAwake } from "@/services/serverWake";

// Só mostra a mensagem se a espera passar disso; com o servidor acordado a
// resposta chega antes e a tela não pisca.
const SHOW_MESSAGE_AFTER_MS = 1_500;

type State = "checking" | "ready" | "failed";

export default function ServerWakeGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(() => (isServerAwake() ? "ready" : "checking"));
  const [showMessage, setShowMessage] = useState(false);
  const [skipped, setSkipped] = useState(false);

  const check = useCallback(() => {
    setState("checking");
    let active = true;
    void ensureServerAwake().then((ok) => {
      if (active) setState(ok ? "ready" : "failed");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (isServerAwake()) return;
    return check();
  }, [check]);

  useEffect(() => {
    if (state !== "checking") return;
    const timer = setTimeout(() => setShowMessage(true), SHOW_MESSAGE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [state]);

  if (state === "ready" || skipped) return <>{children}</>;

  if (state === "failed") {
    return (
      <div role="alert" className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <ServerCrash className="text-purple-500" size={40} />
        <p className="text-base font-bold text-foreground">Não conseguimos falar com o servidor</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Confira sua internet e tente de novo. Se continuar, o servidor pode estar fora do ar.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={check}
            className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white"
          >
            Tentar de novo
          </button>
          <button
            type="button"
            onClick={() => setSkipped(true)}
            className="rounded-xl border border-border px-4 py-2 text-sm font-bold text-foreground"
          >
            Continuar assim mesmo
          </button>
        </div>
      </div>
    );
  }

  if (!showMessage) return null;

  return (
    <div role="status" className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
      <Loader2 className="animate-spin text-purple-500" size={36} />
      <p className="text-base font-bold text-foreground">Conectando ao servidor...</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        Se o app ficou um tempo sem uso, isso pode levar até 1 minuto.
      </p>
    </div>
  );
}
