// Aviso de corrida não finalizada, ao abrir a tela depois de o app ter sido
// fechado no meio de uma corrida (antes dentro de RunTracking.tsx).
import { motion } from "framer-motion";
import { GLASS_CARD_CLASS } from "@/components/GlassCard";
import { cn } from "@/lib/utils";

export default function RecoverRunDialog({
  distanceKm,
  onDiscard,
  onResume,
}: {
  distanceKm: number;
  onDiscard: () => void;
  onResume: () => void;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1200] bg-background/75 backdrop-blur-md"
      />
      <div className="fixed inset-0 z-[1210] flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 28, scale: 0.96 }}
          className={cn(GLASS_CARD_CLASS, "pointer-events-auto w-full max-w-md p-6")}
        >
          <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">Runnex</p>
          <h2 className="mt-1 font-display text-xl font-black text-purple-500 uppercase">Corrida nao finalizada</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Encontramos {distanceKm.toFixed(2)} km de uma corrida que nao chegou a ser salva. Quer continuar de onde parou ou descartar?
          </p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={onDiscard}
              className="flex-1 rounded-xl border border-input bg-secondary py-3 text-xs font-black uppercase tracking-widest text-foreground/80"
            >
              Descartar
            </button>
            <button
              onClick={onResume}
              className="flex-1 rounded-xl bg-purple-600 hover:bg-purple-700 transition py-3 text-xs font-black uppercase tracking-widest text-white"
            >
              Continuar
            </button>
          </div>
        </motion.div>
      </div>
    </>
  );
}
