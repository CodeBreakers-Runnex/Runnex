// Grupo privado: pedir o código para entrar e mostrar o código gerado.
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, Loader2, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { GLASS_CARD_CLASS } from "@/components/GlassCard";
import { cn } from "@/lib/utils";
import { useBackHandler } from "@/hooks/useBackHandler";

function ModalShell({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[1100] bg-background/80 backdrop-blur-md"
          />
          <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className={cn(GLASS_CARD_CLASS, "w-full max-w-sm p-5 pointer-events-auto")}
            >
              {children}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

function CloseButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-muted-foreground disabled:opacity-60"
      aria-label="Fechar"
    >
      <X size={16} />
    </button>
  );
}

// Quem tem o código digita aqui. O erro (código errado, bloqueio por
// tentativas) vem de fora e aparece sob o campo.
export function JoinCodeModal({
  open,
  onClose,
  onSubmit,
  submitting,
  error,
  groupName,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (code: string) => void;
  submitting: boolean;
  error: string | null;
  groupName: string;
}) {
  const [code, setCode] = useState("");
  useBackHandler(open, () => { if (!submitting) onClose(); });

  useEffect(() => {
    if (open) setCode("");
  }, [open]);

  const canSubmit = code.trim().length > 0 && !submitting;

  return (
    <ModalShell open={open} onClose={() => { if (!submitting) onClose(); }}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-xl font-black text-purple-500">
          <Lock size={18} /> GRUPO PRIVADO
        </h2>
        <CloseButton onClick={onClose} disabled={submitting} />
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Para entrar em <span className="font-bold text-foreground">{groupName}</span>, digite o código que quem criou o grupo te passou.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) onSubmit(code.trim());
        }}
      >
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Código do grupo"
          aria-label="Código do grupo"
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          maxLength={64}
          className="w-full rounded-xl border border-input bg-secondary px-4 py-4 text-center font-mono text-lg font-black uppercase tracking-[0.2em] outline-none transition focus:border-purple-500"
        />
        {error && (
          <p role="alert" className="mt-3 text-xs font-bold text-red-400">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-4 text-xs font-black uppercase tracking-widest text-white transition hover:bg-purple-700 disabled:opacity-60"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
          Entrar no grupo
        </button>
      </form>
    </ModalShell>
  );
}

// Mostra o código uma vez: depois de fechar, o servidor não o devolve mais.
export function ShowCodeModal({
  open,
  onClose,
  code,
  groupName,
}: {
  open: boolean;
  onClose: () => void;
  code: string | null;
  groupName: string;
}) {
  const [copied, setCopied] = useState(false);
  useBackHandler(open, onClose);

  useEffect(() => {
    if (open) setCopied(false);
  }, [open]);

  const handleCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      toast.error("Não foi possível copiar. Anote o código acima.");
    }
  };

  return (
    <ModalShell open={open && Boolean(code)} onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-black text-purple-500">CÓDIGO DO GRUPO</h2>
        <CloseButton onClick={onClose} />
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Passe este código para quem pode entrar em <span className="font-bold text-foreground">{groupName}</span>.
        <span className="font-bold text-foreground"> Ele só aparece agora</span>: se perder, gere um novo nas opções do grupo (o anterior deixa de valer).
      </p>
      <p
        data-testid="group-code"
        className="select-all rounded-xl border border-purple-500/30 bg-purple-500/10 py-5 text-center font-mono text-2xl font-black tracking-[0.25em]"
      >
        {code}
      </p>
      <button
        onClick={handleCopy}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 py-4 text-xs font-black uppercase tracking-widest text-purple-300 transition"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? "Copiado" : "Copiar código"}
      </button>
      <button
        onClick={onClose}
        className="mt-3 w-full rounded-xl bg-purple-600 py-4 text-xs font-black uppercase tracking-widest text-white transition hover:bg-purple-700"
      >
        Já anotei
      </button>
    </ModalShell>
  );
}
