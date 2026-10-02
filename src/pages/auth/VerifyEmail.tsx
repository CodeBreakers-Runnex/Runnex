import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Loader2, LogOut, RotateCw } from "lucide-react";
import { sendEmailVerification, signOut } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { toast } from "sonner";

import { actionCodeSettings, auth } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { GLASS_CARD_CLASS } from "@/components/GlassCard";
import { cn } from "@/lib/utils";

import logo from "@/assets/LogoNova-login.png";

// Fase 1.5: tela que segura o usuário até confirmar o email — sem isso,
// contas criadas por email/senha nunca precisavam provar que são donas do
// email usado (login com Google já vem verificado, nunca cai aqui).
export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const cameFromRegister = (location.state as { from?: string } | null)?.from === "register";
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleResend = async () => {
    if (!user) return;
    setResending(true);
    try {
      await sendEmailVerification(user, actionCodeSettings);
      toast.success("Email de confirmação reenviado.");
    } catch (error) {
      const code = error instanceof FirebaseError ? error.code : undefined;
      if (code === "auth/too-many-requests") {
        toast.error("Muitas tentativas. Aguarde alguns minutos antes de tentar de novo.");
      } else {
        toast.error("Não foi possível reenviar o email agora.");
      }
    } finally {
      setResending(false);
    }
  };

  const handleCheckVerified = async () => {
    if (!user) return;
    setChecking(true);
    try {
      await user.reload();
      if (user.emailVerified) {
        toast.success("Email confirmado!");
        navigate(cameFromRegister ? "/complete-profile" : "/", { replace: true });
      } else {
        toast.info("Ainda não encontramos a confirmação. Verifique sua caixa de entrada.");
      }
    } catch {
      toast.error("Não foi possível verificar agora. Tente novamente.");
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-[100svh] bg-background px-4 py-6 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className={cn(GLASS_CARD_CLASS, "w-full max-w-[440px] p-6 sm:p-8 text-center")}
      >
        <img src={logo} alt="Logo Veloxy" className="w-20 h-20 object-contain mx-auto mb-4" />

        <div className="w-14 h-14 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-4">
          <Mail className="text-purple-400" size={26} />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">Confirme seu email</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-1">
          Enviamos um link de confirmação para
        </p>
        <p className="text-sm text-purple-400 font-semibold mb-6 break-all">
          {user?.email}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed mb-6">
          Abra o email e clique no link. Depois, volte aqui e toque em "Já confirmei".
        </p>

        <button
          onClick={handleCheckVerified}
          disabled={checking}
          className="w-full bg-purple-600 hover:bg-purple-700 transition rounded-xl py-3 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 mb-3"
        >
          {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
          Já confirmei
        </button>

        <button
          onClick={handleResend}
          disabled={resending}
          className="w-full bg-secondary border border-input hover:border-purple-500/50 transition rounded-xl py-3 text-foreground/80 text-sm font-semibold disabled:opacity-60 mb-3"
        >
          {resending ? "Reenviando..." : "Reenviar email"}
        </button>

        <button
          onClick={handleLogout}
          className="w-full text-muted-foreground hover:text-foreground/80 transition text-xs flex items-center justify-center gap-2 py-2"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sair e entrar com outra conta
        </button>
      </motion.div>
    </div>
  );
}
