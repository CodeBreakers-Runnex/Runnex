import { useEffect, useRef } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useLocation, useNavigate } from "react-router-dom";

import { ROOT_PATHS, runTopBackHandler } from "@/lib/backButton";

/**
 * Botão voltar do Android: fecha o modal do topo, senão volta uma tela,
 * e na tela inicial minimiza o app (como os apps nativos fazem).
 */
export default function AndroidBackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    const listener = CapacitorApp.addListener("backButton", ({ canGoBack }) => {
      if (runTopBackHandler()) return;

      if (ROOT_PATHS.has(pathRef.current)) {
        void CapacitorApp.minimizeApp();
        return;
      }

      if (canGoBack) navigate(-1);
      else navigate("/", { replace: true });
    });

    return () => {
      void listener.then(handle => handle.remove());
    };
  }, [navigate]);

  return null;
}
