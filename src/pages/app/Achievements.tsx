import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Lock } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { getUserProfile, getUserStats } from "@/services/database";
import type { UserProfile, UserStats } from "@/types";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { GLASS_CARD_CLASS } from "@/components/GlassCard";
import { cn } from "@/lib/utils";

export default function Achievements() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(false);
    try {
      const [statsData, profileData] = await Promise.all([
        getUserStats(user.uid),
        getUserProfile(user.uid),
      ]);
      setStats(statsData);
      setProfile(profileData);
    } catch (error) {
      console.error("Erro ao carregar conquistas:", error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const unlockedCount = stats ? ACHIEVEMENTS.filter((a) => a.unlocked(stats, profile)).length : 0;

  return (
    <div className="app-shell pb-24 safe-top">
      <header className="bg-card/80 backdrop-blur-xl border-b border-border sticky top-0 z-40 px-5 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card/80 backdrop-blur-xl border border-border text-muted-foreground"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Perfil</p>
            <h1 className="font-display text-xl font-black">Conquistas</h1>
          </div>
          {!loading && !loadError && (
            <div className="rounded-full border border-purple-500/25 bg-purple-500/10 px-3 py-2 text-xs font-black text-purple-300">
              {unlockedCount}/{ACHIEVEMENTS.length}
            </div>
          )}
        </div>
      </header>

      {loading ? (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <Loader2 className="animate-spin text-purple-500" size={36} />
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground/70">Carregando conquistas</p>
        </div>
      ) : loadError ? (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-6 text-center">
          <p className="font-display text-xl font-black">Erro ao carregar dados</p>
          <p className="text-sm text-muted-foreground">Não foi possível carregar suas conquistas agora.</p>
          <button
            onClick={loadData}
            className="rounded-xl bg-purple-600 hover:bg-purple-700 transition px-6 py-3 text-xs font-black uppercase tracking-widest text-white"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <section className="px-6 pt-6 grid grid-cols-2 gap-4">
          {ACHIEVEMENTS.map((achievement, index) => {
            const unlocked = stats ? achievement.unlocked(stats, profile) : false;
            const detail = stats ? achievement.detail(stats, profile) : "";

            return (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.4) }}
                className={cn("flex flex-col items-center gap-3 p-5 text-center", GLASS_CARD_CLASS, !unlocked && "opacity-45")}
              >
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/15 text-purple-500 shadow-[0_0_18px_rgba(147,51,234,0.14)]">
                  {unlocked ? <achievement.icon size={24} /> : <Lock size={20} />}
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase leading-tight">{achievement.name}</p>
                  <p className="mt-1.5 text-[9px] font-bold text-muted-foreground">{detail}</p>
                </div>
              </motion.div>
            );
          })}
        </section>
      )}
    </div>
  );
}
