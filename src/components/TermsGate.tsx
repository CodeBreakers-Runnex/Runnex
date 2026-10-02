import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { auth } from "@/config/firebase";
import { LEGAL_VERSION } from "@/content/legalContent";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiError } from "@/services/apiClient";
import { createUserProfile } from "@/services/database";
import type { UserProfile } from "@/types";

type Pending = { reason: "first" | "update"; profileMissing: boolean };

// Pede o aceite dos Termos e da Política de Privacidade quando a versão
// aceita pelo usuário difere de LEGAL_VERSION. Cobre dois casos que antes
// passavam direto: quem entra com Google (o login nunca mostrava os termos)
// e quem aceitou uma versão antiga. Se o backend estiver fora do ar, não
// bloqueia o app: só aparece quando a falta do aceite é confirmada.
export default function TermsGate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState<Pending | null>(null);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;

    api
      .get<UserProfile>(`/users/${user.uid}`)
      .then((profile) => {
        if (cancelled || profile.termsVersion === LEGAL_VERSION) return;
        setPending({ reason: profile.termsVersion ? "update" : "first", profileMissing: false });
      })
      .catch((error) => {
        if (!cancelled && error instanceof ApiError && error.status === 404) {
          setPending({ reason: "first", profileMissing: true });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user || !pending) return null;

  const handleAccept = async () => {
    setSaving(true);
    try {
      await createUserProfile(user.uid, {
        termsVersion: LEGAL_VERSION,
        // Sem perfil no backend ainda (ex.: primeiro login com Google), o
        // mesmo PUT cria a linha com o nome e a foto da conta.
        ...(pending.profileMissing ? { displayName: user.displayName, photoURL: user.photoURL } : {}),
      });
      setPending(null);
    } catch (error) {
      console.error("Erro ao registrar aceite dos termos:", error);
      toast.error("Não foi possível registrar o aceite. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleDecline = async () => {
    await signOut(auth);
    navigate("/login", { replace: true });
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-background/90 p-4 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-gate-title"
        className="w-full max-w-md space-y-4 rounded-3xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck size={24} />
        </div>
        <h2 id="terms-gate-title" className="font-display text-xl font-black">
          {pending.reason === "update" ? "Atualizamos nossos termos" : "Antes de continuar"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {pending.reason === "update"
            ? "Os Termos de Uso e a Política de Privacidade mudaram. A nova versão descreve com mais detalhes quais dados o Runnex coleta, quem pode vê-los e como exercer seus direitos."
            : "Para usar o Runnex, você precisa ler e aceitar os Termos de Uso e a Política de Privacidade."}
        </p>
        <Link to="/termos-e-privacidade" className="inline-block text-sm font-bold text-primary underline">
          Ler os Termos e a Política de Privacidade
        </Link>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
          />
          <span>Li e aceito os Termos de Uso e a Política de Privacidade.</span>
        </label>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleDecline}
            disabled={saving}
            className="flex-1 rounded-xl border border-border py-3 text-xs font-black uppercase tracking-widest text-muted-foreground transition disabled:opacity-60"
          >
            Sair
          </button>
          <button
            onClick={handleAccept}
            disabled={!checked || saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-black uppercase tracking-widest text-primary-foreground transition disabled:opacity-40"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Aceitar
          </button>
        </div>
      </div>
    </div>
  );
}
