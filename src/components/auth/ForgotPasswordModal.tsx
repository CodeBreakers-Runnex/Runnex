import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mail, X, Loader2, LockKeyhole } from "lucide-react";
import { sendPasswordResetEmail } from "firebase/auth";
import { toast } from "sonner";

import { actionCodeSettings, auth } from "@/config/firebase";
import { getFirebaseAuthErrorMessage } from "@/lib/firebaseAuthErrors";
import { GLASS_CARD_CLASS } from "@/components/GlassCard";
import { cn } from "@/lib/utils";

interface ForgotPasswordModalProps {
  open: boolean;
  onClose: () => void;
  initialEmail?: string;
}

export default function ForgotPasswordModal({
  open,
  onClose,
  initialEmail = "",
}: ForgotPasswordModalProps) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail(initialEmail);
    }
  }, [open, initialEmail]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const emailLimpo = email.trim();

    if (!emailLimpo) {
      toast.error("Digite seu email.");
      return;
    }

    try {
      setLoading(true);

      // Deixa o email enviado pelo Firebase em português
      auth.languageCode = "pt-BR";

      await sendPasswordResetEmail(auth, emailLimpo, actionCodeSettings);

      toast.success(
        "Email de recuperação enviado! Verifique sua caixa de entrada.",
      );

      onClose();
    } catch (error: unknown) {
      console.error("Erro ao recuperar senha:", error);

      toast.error(getFirebaseAuthErrorMessage(error, "reset-password"));
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (!loading) {
      onClose();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              handleClose();
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4"
        >
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.95,
              y: 20,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              scale: 0.95,
              y: 20,
            }}
            transition={{
              duration: 0.2,
            }}
            className={cn(GLASS_CARD_CLASS, "relative w-full max-w-md p-5 shadow-2xl sm:p-8")}
          >
            {/* Fechar */}
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="absolute right-5 top-5 text-muted-foreground transition hover:text-foreground disabled:opacity-50"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Cabeçalho */}
            <div className="mb-5 flex flex-col items-center text-center">
              <motion.div
                animate={{
                  rotate: [0, -10, 10, -6, 0],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  repeatDelay: 1.5,
                  ease: "easeInOut",
                }}
                className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10"
              >
                <LockKeyhole className="h-7 w-7 text-purple-400" />
              </motion.div>

              <h2 className="text-3xl font-bold text-foreground">
                Recuperar senha
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Digite o email da sua conta e enviaremos um link para você
                criar uma nova senha.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground/80">
                  Email
                </label>

                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" />

                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Digite seu email"
                    autoComplete="email"
                    autoFocus
                    disabled={loading}
                    className="w-full rounded-xl border border-input bg-secondary py-3 pl-11 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-purple-500 disabled:opacity-60"
                  />
                </div>
              </div>

              <motion.button
                whileHover={!loading ? { scale: 1.01 } : {}}
                whileTap={!loading ? { scale: 0.99 } : {}}
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar link de recuperação"
                )}
              </motion.button>

              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="w-full py-1 text-sm text-muted-foreground transition hover:text-foreground disabled:opacity-50"
              >
                Cancelar
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}