import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  MapPin,
  Flame,
  Timer,
  Zap,
  BarChart3,
  Activity,
  Play,
  TrendingUp,
  Award,
  Loader2
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getUserStats, ActivityData, getUserProfile, UserProfile } from "@/services/database";
import { getLevelFromXP } from "@/lib/gamification";
import { toDateSafe } from "@/lib/feed-utils";
import { GLASS_CARD_CLASS } from "@/components/GlassCard";
import { cn } from "@/lib/utils";

type StatsResult = {
  totalKm: string;
  runsCount: number;
  totalTime: string;
  totalCalories: number;
  averagePace: string;
  currentStreak: number;
  weeklyTotalKm: number;
  bestActivity: (ActivityData & { id: string }) | null;
  lastActivity: (ActivityData & { id: string }) | null;
  weeklyData: { day: string; km: number }[];
};

const DEFAULT_STATS: StatsResult = {
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
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<StatsResult>(DEFAULT_STATS);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const displayName = user?.displayName || "Corredor";
  const userInitials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      try {
        const [statsData, profileData] = await Promise.all([
          getUserStats(user.uid),
          getUserProfile(user.uid)
        ]);
        setStats(statsData as StatsResult);
        setProfile(profileData);
      } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  const levelInfo = getLevelFromXP(profile?.totalXP || 0);

  const weeklyData = stats.weeklyData;
  const maxKm = Math.max(...weeklyData.map((d) => d.km), 1);
  const hasRuns = stats.runsCount > 0;
  const bestRunDistance = stats.bestActivity ? stats.bestActivity.distance.toFixed(2) : "0.00";

  // Formatar data da última atividade
  const formatLastRunDate = (activity: (ActivityData & { id: string }) | null) => {
    if (!activity?.timestamp) return "—";
    const date = toDateSafe(activity.timestamp);
    if (!date) return "—";
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    if (isToday) return `HOJE • ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).toUpperCase();
  };

  const realStatCards = useMemo(() => [
    { label: "Distancia Total", value: stats.totalKm, unit: "KM", icon: <MapPin size={16} />, color: "purple" },
    { label: "Km na Semana", value: stats.weeklyTotalKm.toFixed(1), unit: "KM", icon: <TrendingUp size={16} />, color: "purple" },
    { label: "Ritmo Medio", value: stats.averagePace, unit: "/KM", icon: <Timer size={16} />, color: "zinc" },
    { label: "Sequencia", value: stats.currentStreak.toString(), unit: stats.currentStreak === 1 ? "DIA" : "DIAS", icon: <Zap size={16} />, color: "zinc" },
    { label: "Calorias", value: stats.totalCalories.toString(), unit: "KCAL", icon: <Flame size={16} />, color: "zinc" },
    { label: "Melhor Corrida", value: bestRunDistance, unit: "KM", icon: <Award size={16} />, color: "zinc" },
  ], [stats, bestRunDistance]);

  return (
    <div className="app-shell pb-24 safe-top">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-xl border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center border border-input overflow-hidden">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-bold text-purple-500">{userInitials}</span>
          )}
        </div>

        <h1 className="font-display font-black text-2xl tracking-tighter text-purple-500">
          VELOXY STATS
        </h1>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate("/run")}
          className="bg-purple-600 w-10 h-10 rounded-full flex items-center justify-center"
          aria-label="Iniciar corrida"
        >
          <Play size={16} className="text-white fill-current ml-0.5" />
        </motion.button>
      </header>

      {/* Welcome & Level Badge */}
      <section className="px-6 mt-8">
        <div className="flex items-start justify-between">
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
            <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em] mb-1">
              Bem-vindo de volta,
            </p>
            {loading ? (
              <Skeleton className="h-10 w-32 rounded-lg" />
            ) : (
              <h2 className="font-display font-black text-4xl tracking-tighter text-foreground uppercase">
                {displayName.split(" ")[0]}
              </h2>
            )}
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 10 }} 
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col items-end"
          >
            {loading ? (
               <Skeleton className="h-6 w-20 rounded-full mb-2" />
            ) : (
               <>
                 <div className="bg-purple-600 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-[0_0_15px_rgba(147,51,234,0.3)]">
                     <Award size={12} className="text-white fill-current" />
                     <span className="text-[10px] font-black tracking-widest text-white">NÍVEL {levelInfo.currentLevel.toUpperCase()}</span>
                 </div>
                 <p className="text-[10px] font-black text-purple-400 mt-2 tracking-tighter">
                     {profile?.totalXP?.toLocaleString("pt-BR") || "0"} XP TOTAL
                 </p>
               </>
            )}
          </motion.div>
        </div>
      </section>

      {/* Stats Grid */}
      <section className="px-6 mt-10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display font-black text-sm tracking-tighter uppercase flex items-center gap-2">
            <Activity size={16} className="text-purple-500" />
            Performance Geral
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {loading ? (
            <>
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-36 rounded-3xl" />)}
            </>
          ) : (
            realStatCards.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={cn(GLASS_CARD_CLASS, "p-6 relative group")}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center mb-3 ${
                    stat.color === "purple"
                      ? "bg-purple-500/20 text-purple-400"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {stat.icon}
                </div>
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">
                  {stat.label}
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black font-display text-foreground leading-none">
                    {stat.value}
                  </span>
                  <span className="text-[9px] font-black text-purple-500 uppercase tracking-tighter">
                    {stat.unit}
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </section>

      {/* Weekly Chart */}
      <section className="px-6 mt-10">
        <div className={cn(GLASS_CARD_CLASS, "p-7")}>
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-display font-black text-sm tracking-tighter uppercase text-foreground">
              Últimos 7 Dias
            </h3>
            <div className="flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full">
              <Zap size={10} className="text-purple-500 fill-current" />
              <span className="text-[9px] font-black text-purple-400">
                {stats.runsCount} {stats.runsCount === 1 ? "CORRIDA" : "CORRIDAS"}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center h-32 items-center">
              <Loader2 className="animate-spin text-purple-500" size={24} />
            </div>
          ) : !hasRuns ? (
            <div className="flex flex-col items-center justify-center h-32 gap-3">
              <TrendingUp size={28} className="text-muted-foreground/50" />
              <p className="text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest">
                Nenhuma corrida ainda
              </p>
            </div>
          ) : (
            <div className="flex items-end justify-between gap-3 h-32">
              {weeklyData.map((d, i) => (
                <div key={i} className="flex flex-col items-center gap-3 flex-1">
                  <div className="relative w-full flex flex-col items-center">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(d.km / maxKm) * 100}px` }}
                      transition={{ delay: i * 0.1, duration: 0.7, ease: "easeOut" }}
                      className={`w-full max-w-10 rounded-2xl ${
                        d.km > 0
                          ? "bg-gradient-to-t from-purple-600 to-purple-400 shadow-[0_0_15px_rgba(147,51,234,0.3)]"
                          : "bg-secondary/50"
                      }`}
                      style={{ minHeight: d.km > 0 ? "10px" : "4px" }}
                    />
                  </div>
                  <span
                    className={`text-[8px] font-black tracking-tighter ${
                      d.km > 0 ? "text-purple-400" : "text-muted-foreground/70"
                    }`}
                  >
                    {d.day}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* No desktop, melhor corrida e última atividade ficam lado a lado */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:px-6">
      {/* Best Run Card */}
      {stats.bestActivity && (
        <section className="px-6 mt-10 lg:px-0">
          <div className="rounded-3xl border border-purple-500/20 bg-purple-500/10 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-purple-300">
                  Melhor corrida
                </p>
                <h3 className="mt-2 font-display text-3xl font-black text-foreground">
                  {stats.bestActivity.distance.toFixed(2)} km
                </h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-600 text-white">
                <Award size={22} />
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { label: "PACE", value: stats.bestActivity.pace },
                { label: "TEMPO", value: stats.bestActivity.time },
                { label: "KCAL", value: (stats.bestActivity.calories ?? 0).toString() },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-background/30 p-3">
                  <p className="font-display text-lg font-black text-foreground leading-none">{item.value}</p>
                  <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Last Run Card */}
      <section className="px-6 mt-10 pb-10 lg:px-0">
        <h3 className="font-display font-black text-sm tracking-tighter uppercase mb-6 flex items-center gap-2">
          <BarChart3 size={16} className="text-purple-500" />
          Última Atividade
        </h3>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="animate-spin text-purple-500" size={24} />
          </div>
        ) : stats.lastActivity ? (
          <div className={cn(GLASS_CARD_CLASS, "p-8 relative overflow-hidden")}>
            {/* purple glow blob */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex items-center justify-between mb-8">
              <div>
                <h4 className="font-display font-black text-xl text-foreground uppercase">
                  {stats.lastActivity.type === "RUNNING" ? "Corrida" : stats.lastActivity.type}
                </h4>
                <p className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">
                  {formatLastRunDate(stats.lastActivity)}
                </p>
              </div>
              <div className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full">
                <span className="text-[9px] font-black text-purple-400 tracking-widest">
                  GPS REAL
                </span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "KM",    value: stats.lastActivity.distance.toFixed(2) },
                { label: "PACE",  value: stats.lastActivity.pace },
                { label: "TEMPO", value: stats.lastActivity.time },
                { label: "KCAL",  value: (stats.lastActivity.calories ?? 0).toString() },
              ].map((s) => (
                <div key={s.label} className="text-left">
                  <p className="font-display font-black text-lg text-foreground leading-none mb-1">
                    {s.value}
                  </p>
                  <p className="text-[8px] font-bold text-muted-foreground/70 uppercase tracking-[0.2em]">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={cn(GLASS_CARD_CLASS, "p-10 flex flex-col items-center gap-4")}
          >
            <div className="w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Play size={28} className="text-purple-500 fill-current ml-1" />
            </div>
            <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest text-center">
              Ainda sem corridas registradas
            </p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/run")}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 transition rounded-xl text-[11px] font-black uppercase tracking-widest text-white"
            >
              Iniciar Primeira Corrida
            </motion.button>
          </motion.div>
        )}
      </section>
      </div>
    </div>
  );
};

export default Dashboard;
