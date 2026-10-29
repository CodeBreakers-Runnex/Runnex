import { useEffect, useRef } from "react";

import { pushBackHandler } from "@/lib/backButton";

/**
 * Enquanto `active` for true, o botão voltar do Android chama `handler`
 * em vez de mudar de tela. Use em modais (handler = fechar) e em telas que
 * precisam confirmar a saída. Um handler vazio só bloqueia o voltar.
 */
export function useBackHandler(active: boolean, handler: () => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!active) return undefined;
    return pushBackHandler(() => handlerRef.current());
  }, [active]);
}
