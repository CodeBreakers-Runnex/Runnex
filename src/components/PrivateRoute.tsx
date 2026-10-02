import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { auth } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";

function PrivateRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  const currentUser = user ?? auth.currentUser;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-purple-500" size={36} />

        <p className="text-[10px] font-black text-muted-foreground tracking-[0.2em] uppercase">
          Carregando...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Fase 1.5: login com Google já vem com emailVerified=true (o Firebase
  // seta isso automaticamente para provedores federados) — só contas
  // criadas por email/senha caem nesse bloqueio.
  if (!currentUser.emailVerified) {
    return <Navigate to="/verificar-email" replace />;
  }

  return <>{children}</>;
}

export default PrivateRoute;
