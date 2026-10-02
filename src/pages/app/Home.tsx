import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Bot,
  ChevronRight,
  Flame,
  Loader2,
  MapPin,
  PawPrint,
  Ruler,
  Timer,
  Trophy,
  Zap,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { deleteUserActivity, getUserActivities, getUserProfile, getUserStats } from "@/services/database";
import type { FeedActivity, UserProfile, UserStats } from "@/types";
import { toDateSafe } from "@/lib/feed-utils";
import SafeAvatar from "@/components/SafeAvatar";
import RunHistoryRow from "@/components/RunHistoryRow";
import { getBestUserPhotoURL } from "@/lib/user-photo";
import { getPetMood, getPetSpeciesInfo } from "@/lib/pet";
import { getStoredSettings, updateStoredSettings } from "@/lib/settings";
import type { DistanceUnit } from "@/lib/settings";
import { GLASS_CARD_CLASS } from "@/components/GlassCard";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const KM_TO_MI = 0.621371;

function formatDistance(km: number, unit: DistanceUnit) {
  return (unit === "mi" ? km * KM_TO_MI : km).toFixed(1);
}

const EMPTY_STATS: UserStats = {
  totalKm: "0.0",
  runsCount: 0,
  totalTime: "0m",
  totalCalories: 0,
  averagePace: "0'00\"",
  currentStreak: 0,
  weeklyTotalKm: 0,
  bestActivity: null,
  lastActivity: null,
  weeklyData: [],
  hasHourLongRun: false,
  hasSub10kRun: false,
  dawnRunsCount: 0,
  nightRunsCount: 0,
};

function formatRunDate(activity: FeedActivity) {
  const date = toDateSafe(activity.timestamp) ?? (
    typeof activity.createdAtMs === "number" ? new Date(activity.createdAtMs) : null
  );
  if (!date) return "Sem data";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).toUpperCase();
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats>(EMPTY_STATS);
  const [activities, setActivities] = useState<FeedActivity[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [unit, setUnit] = useState<DistanceUnit>(() => getStoredSettings().units);
  const [unitModalOpen, setUnitModalOpen] = useState(false);

  const displayName = user?.displayName || "Corredor";
  const firstName = displayName.split(" ")[0] || "Corredor";
  const userPhotoURL = getBestUserPhotoURL(user);
  const petSpeciesInfo = getPetSpeciesInfo(profile?.petSpecies);
  const petMood = getPetMood(stats.currentStreak);

  const loadHomeData = useCallback(async () => {
    if (!user) return;
    try {
      const [statsData, runs, userProfile] = await Promise.all([
        getUserStats(user.uid),
        getUserActivities(user.uid, 8),
        getUserProfile(user.uid),
      ]);
      setStats(statsData);
      setActivities(runs);
      setProfile(userProfile);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadHomeData();
  }, [loadHomeData]);

  const handleDeleteRun = async (run: FeedActivity) => {
    if (!user) return;

    if (confirmDeleteId !== run.id) {
      setConfirmDeleteId(run.id);
      toast.warning("Toque na lixeira novamente para apagar esta corrida.");
      return;
    }

    setDeletingId(run.id);
    try {
      await deleteUserActivity(run.id, user.uid);
      setConfirmDeleteId(null);
      toast.success("Corrida apagada.");
      await loadHomeData();
    } catch (error) {
      console.error("Erro ao apagar corrida:", error);
      const message = error instanceof Error ? error.message : "Não foi possível apagar esta corrida.";
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  const maxKm = Math.max(...stats.weeklyData.map((day) => day.km), 1);
  const lastRun = stats.lastActivity;

  const summaryCards = useMemo(() => [
    { label: "Semana", value: formatDistance(stats.weeklyTotalKm, unit), unit, icon: TrendingIcon },
    { label: "Ritmo medio", value: stats.averagePace, unit: "/km", icon: Timer },
    { label: "Sequencia", value: stats.currentStreak.toString(), unit: stats.currentStreak === 1 ? "dia" : "dias", icon: Zap },
    { label: "Calorias", value: stats.totalCalories.toString(), unit: "kcal", icon: Flame },
  ], [stats, unit]);

  const handleConfirmUnitChange = () => {
    const next: DistanceUnit = unit === "km" ? "mi" : "km";
    setUnit(next);
    updateStoredSettings("units", next);
    setUnitModalOpen(false);
    toast.success(`Distâncias agora exibidas em ${next === "mi" ? "milhas" : "quilômetros"}.`);
  };

  return (
    <div className="app-shell pb-28 safe-top">
      <header className="bg-card/80 backdrop-blur-xl border-b border-border sticky top-0 z-40 px-6 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/profile")}
            className="h-11 w-11 overflow-hidden rounded-full border border-purple-500/30 bg-card flex items-center justify-center"
          >
            <SafeAvatar
              src={userPhotoURL}
              name={displayName}
              alt="Perfil"
              className="h-full w-full rounded-full"
              fallbackClassName="text-xs font-black text-purple-500"
            />
          </button>
          <div className="text-center">
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground/70">Veloxy</p>
            <h1 className="font-display text-2xl font-black tracking-tighter text-purple-500">
              INICIO
            </h1>
          </div>
          <button
            onClick={() => navigate("/pet")}
            className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border bg-card ${
              petMood === "feliz" ? "border-purple-500/40" : "border-border"
            }`}
            aria-label="Ver seu pet"
          >
            {petSpeciesInfo ? (
              <span className="text-xl">{petSpeciesInfo.emoji}</span>
            ) : (
              <PawPrint size={18} className="text-muted-foreground" />
            )}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4">
          <Loader2 className="animate-spin text-purple-500" size={36} />
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground/70">Carregando corridas</p>
        </div>
      ) : (
        <div className="lg:grid lg:grid-cols-2 lg:gap-8 lg:px-6">
          <div>
          <section className="px-6 pt-8 lg:px-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Suas corridas</p>
            <h2 className="mt-2 font-display text-4xl font-black uppercase tracking-tighter">
              Bora, {firstName}
            </h2>

            <div className={cn(GLASS_CARD_CLASS, "shadow-2xl mt-6 p-6")}>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.22em] text-purple-300">Distancia total</p>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="font-display text-6xl font-black leading-none text-foreground">{formatDistance(Number(stats.totalKm), unit)}</span>
                    <span className="mb-2 text-xs font-black uppercase text-purple-400">{unit}</span>
                  </div>
                </div>
                <button
                  onClick={() => setUnitModalOpen(true)}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-600 text-white active:scale-95 transition-transform"
                  aria-label="Alternar unidade de distância entre km e milhas"
                >
                  <Activity size={24} />
                </button>
              </div>

              <div className="mt-7 grid grid-cols-3 gap-3">
                {[
                  { label: "Corridas", value: stats.runsCount },
                  { label: "Tempo", value: stats.totalTime },
                  { label: "Melhor", value: stats.bestActivity ? `${formatDistance(stats.bestActivity.distance, unit)}${unit}` : `0${unit}` },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl bg-secondary/60 border border-input p-3">
                    <p className="whitespace-nowrap font-display text-lg font-black leading-none sm:text-xl">{item.value}</p>
                    <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-6 grid grid-cols-2 gap-3 px-6 lg:px-0">
            {summaryCards.map((card, index) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(GLASS_CARD_CLASS, "rounded-2xl p-4")}
              >
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-500">
                  <card.icon size={17} />
                </div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">{card.label}</p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="font-display text-2xl font-black">{card.value}</span>
                  <span className="text-[9px] font-black uppercase text-purple-500">{card.unit}</span>
                </div>
              </motion.div>
            ))}
          </section>

          <section className="mt-6 px-6 lg:px-0">
            <button
              onClick={() => navigate("/treinador")}
              className={cn(GLASS_CARD_CLASS, "flex w-full items-center gap-4 rounded-2xl p-4 text-left transition hover:border-purple-500/40")}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-500">
                <Bot size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black">Treinador virtual</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Dúvidas de treino, pace, zonas e suas metas</p>
              </div>
              <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
            </button>
          </section>

          <section className="mt-8 px-6 lg:px-0">
            <div className={cn(GLASS_CARD_CLASS, "p-5")}>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Ultimos 7 dias</p>
                  <h3 className="mt-1 font-display text-xl font-black">Progresso semanal</h3>
                </div>
                <div className="rounded-full bg-purple-500/10 px-3 py-1 text-[10px] font-black text-purple-400">
                  {formatDistance(stats.weeklyTotalKm, unit)} {unit}
                </div>
              </div>
              <div className="flex h-28 items-end gap-3">
                {stats.weeklyData.map((day) => (
                  <div key={day.day} className="flex flex-1 flex-col items-center gap-2">
                    <motion.div
                      initial={{ height: 4 }}
                      animate={{ height: Math.max(6, (day.km / maxKm) * 96) }}
                      className={`w-full max-w-8 rounded-full ${day.km > 0 ? "bg-purple-500" : "bg-secondary"}`}
                    />
                    <span className="text-[8px] font-black text-muted-foreground">{day.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          </div>

          <section className="mt-8 px-6 lg:mt-0 lg:px-0 lg:pt-8">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-black uppercase">Corridas recentes</h3>
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Somente suas</span>
            </div>

            <div className="mt-4 space-y-3">
              {activities.length === 0 ? (
                <div className={cn(GLASS_CARD_CLASS, "p-8 text-center")}>
                  <Trophy size={34} className="mx-auto text-muted-foreground/50" />
                  <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Nenhuma corrida salva ainda</p>
                  <button
                    onClick={() => navigate("/run")}
                    className="mt-5 rounded-xl bg-purple-600 hover:bg-purple-700 transition px-6 py-3 text-xs font-black uppercase tracking-widest text-white"
                  >
                    Comecar corrida
                  </button>
                </div>
              ) : (
                activities.map((run) => (
                  <RunHistoryRow
                    key={run.id}
                    run={run}
                    dateLabel={formatRunDate(run)}
                    onSelect={() => navigate("/stats")}
                    onDelete={() => handleDeleteRun(run)}
                    deleting={deletingId === run.id}
                    confirmDelete={confirmDeleteId === run.id}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      )}

      <AnimatePresence>
        {unitModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setUnitModalOpen(false)}
              className="fixed inset-0 z-[1100] bg-background/80 backdrop-blur-md"
            />
            <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                className={cn(GLASS_CARD_CLASS, "w-full max-w-sm p-6 text-center pointer-events-auto")}
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-500">
                  <Ruler size={24} />
                </div>
                <h2 className="mt-4 font-display text-xl font-black">Trocar unidade de distância?</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Suas distâncias vão passar a ser exibidas em {unit === "km" ? "milhas (mi)" : "quilômetros (km)"}.
                </p>
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setUnitModalOpen(false)}
                    className="flex-1 rounded-xl border border-border bg-secondary/60 py-3 text-xs font-black uppercase tracking-widest text-foreground/80"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmUnitChange}
                    className="flex-1 rounded-xl bg-purple-600 hover:bg-purple-700 transition py-3 text-xs font-black uppercase tracking-widest text-white"
                  >
                    Confirmar
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function TrendingIcon(props: React.ComponentProps<typeof MapPin>) {
  return <MapPin {...props} />;
}
