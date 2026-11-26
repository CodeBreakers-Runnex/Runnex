// Atalhos de música da tela de corrida. Desligado nesta versão
// (features.music em src/config/features.ts); antes dentro de RunTracking.tsx.
import { motion } from "framer-motion";
import { ExternalLink, X } from "lucide-react";
import { GLASS_CARD_CLASS } from "@/components/GlassCard";
import { cn } from "@/lib/utils";

export default function MusicSheet({ onClose }: { onClose: () => void }) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1200] bg-background/75 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[1210] flex items-end justify-center p-4 pointer-events-none sm:items-center">
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 28, scale: 0.96 }}
          className={cn(GLASS_CARD_CLASS, "pointer-events-auto w-full max-w-md p-5")}
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">Treino</p>
              <h2 className="font-display text-2xl font-black text-purple-500">Musica</h2>
            </div>
            <button
              onClick={onClose}
              className="bg-card border border-border flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground"
              aria-label="Fechar musica"
            >
              <X size={18} />
            </button>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            Abra sua playlist antes ou durante a corrida. O Runnex continua acompanhando o treino quando você voltar para o app.
          </p>
          <div className="grid gap-3">
            {[
              { label: "Spotify", url: "https://open.spotify.com/search/running%20playlist" },
              { label: "YouTube Music", url: "https://music.youtube.com/search?q=running+playlist" },
              { label: "Deezer", url: "https://www.deezer.com/search/running%20playlist" },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")}
                className="bg-card border border-border flex items-center justify-between rounded-2xl px-4 py-4 text-left text-sm font-black"
              >
                {item.label}
                <ExternalLink size={16} className="text-purple-500" />
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </>
  );
}
