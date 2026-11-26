// Opções do grupo: dados e sair (antes dentro de Group.tsx).
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, LogOut, X } from "lucide-react";
import type { RunningGroup } from "@/types";
import { GLASS_CARD_CLASS } from "@/components/GlassCard";
import { cn } from "@/lib/utils";
import { useBackHandler } from "@/hooks/useBackHandler";

export default function GroupOptionsModal({ open, onClose, group, onLeave, leaving }: {
  open: boolean;
  onClose: () => void;
  group: RunningGroup;
  onLeave: () => void;
  leaving: boolean;
}) {
  useBackHandler(open, () => { if (!leaving) onClose(); });
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
          <div className="fixed inset-0 z-[1200] flex items-end lg:items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className={cn(GLASS_CARD_CLASS, "w-full max-w-md p-5 pointer-events-auto")}
            >
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-display text-xl font-black text-purple-500">OPÇÕES DO GRUPO</h2>
                <button onClick={onClose} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-muted-foreground" aria-label="Fechar">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-border bg-secondary/50 p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Cidade</p>
                  <p className="text-sm font-bold">{group.city}</p>
                </div>
                <div className="rounded-2xl border border-border bg-secondary/50 p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Criado por</p>
                  <p className="text-sm font-bold">{group.creatorName}</p>
                </div>

                <button
                  onClick={onLeave}
                  disabled={leaving}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 py-4 text-xs font-black uppercase tracking-widest text-red-400 disabled:opacity-60"
                >
                  {leaving ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                  Sair do grupo
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
