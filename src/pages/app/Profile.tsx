import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { auth } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Settings,
  ChevronRight,
  MapPin,
  Calendar,
  Pencil,
  LogOut,
  Camera,
  Loader2,
  Zap,
  Moon,
  BarChart3,
  PawPrint,
  Footprints,
  Watch,
} from "lucide-react";
import {
  createUserProfile,
  getUserActivities,
  getUserStats,
  getUserProfile,
  UserProfile,
  UserStats,
} from "@/services/database";
import type { FeedActivity } from "@/types";
import { getLevelFromXP } from "@/lib/gamification";
import { toDateSafe } from "@/lib/feed-utils";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { getPetSpeciesInfo } from "@/lib/pet";
import { GLASS_CARD_CLASS } from "@/components/GlassCard";
import { cn } from "@/lib/utils";
import RunHistoryRow from "@/components/RunHistoryRow";
import ScreenTitle from "@/components/ScreenTitle";
import { features } from "@/config/features";
import SettingsModal from "@/pages/app/profile/SettingsModal";
import EditProfileModal from "@/pages/app/profile/EditProfileModal";
import { type Theme, applyTheme, getStoredTheme, playThemeTransition } from "@/pages/app/profile/theme";

function formatRunHistoryDate(activity: FeedActivity) {
  const date = toDateSafe(activity.timestamp) ?? (
    typeof activity.createdAtMs === "number" ? new Date(activity.createdAtMs) : null
  );
  if (!date) return "Sem data";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });
}

function getRealAchievements(stats: UserStats | null, profile: UserProfile | null) {
  return ACHIEVEMENTS.map((achievement) => ({
    icon: <achievement.icon size={20} />,
    name: achievement.name,
    detail: stats ? achievement.detail(stats, profile) : "Carregando...",
    unlocked: stats ? achievement.unlocked(stats, profile) : false,
  }));
}

/* ===================== PROFILE PAGE ===================== */
const Profile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [editOpen, setEditOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [statsData, setStatsData] = useState<UserStats | null>(null);
  const [runHistory, setRunHistory] = useState<FeedActivity[]>([]);
  const [loadError, setLoadError] = useState(false);

  const fetchProfileData = useCallback(async () => {
    if (!user) return;
    setLoadError(false);
    try {
      const [userStats, userProfile, history] = await Promise.all([
        getUserStats(user.uid),
        getUserProfile(user.uid),
        getUserActivities(user.uid, 20)
      ]);
      setStatsData(userStats);
      setProfile(userProfile);
      setRunHistory(history);
    } catch (error) {
      // Sem isso a tela mostrava XP 0 e histórico vazio, como se fosse uma conta nova.
      console.error("Erro ao carregar perfil:", error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const handleThemeChange = useCallback((nextTheme: Theme) => {
    if (nextTheme === theme) return;
    playThemeTransition(nextTheme);
    setTheme(nextTheme);
  }, [theme]);

  const displayName = user?.displayName || "Corredor";
  const petSpeciesInfo = getPetSpeciesInfo(profile?.petSpecies);
  const initials = displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  
  // Níveis e Progressão
  const levelInfo = getLevelFromXP(profile?.totalXP || 0);
  const weeklyGoalKm = profile?.weeklyGoalKm ?? 10;
  const weeklyKm = statsData?.weeklyTotalKm ?? 0;
  const weeklyProgress = weeklyGoalKm > 0 ? Math.min((weeklyKm / weeklyGoalKm) * 100, 100) : 0;
  const realAchievements = getRealAchievements(statsData, profile);

  const handlePrivacyChange = async (value: boolean) => {
    if (!user) return;
    try {
      await createUserProfile(user.uid, { privateProfile: value });
      setProfile((prev) => prev ? { ...prev, privateProfile: value } : prev);
      toast.success(value ? "Perfil privado ativado." : "Perfil público ativado.");
    } catch (error) {
      console.error("Erro ao atualizar privacidade:", error);
      toast.error("Não foi possível atualizar a privacidade.");
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      toast.success("Logout realizado");
      navigate("/login");
    } catch {
      toast.error("Erro ao fazer logout");
    }
  };

  if (loading) {
    return (
      <div className="app-shell flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-purple-500" size={40} />
        <p className="text-[10px] font-black text-muted-foreground tracking-[0.2em] uppercase">Carregando Perfil...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="app-shell flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm font-black">Não foi possível carregar seu perfil.</p>
        <p className="text-xs text-muted-foreground">Confira sua conexão e tente de novo.</p>
        <button
          onClick={() => { setLoading(true); void fetchProfileData(); }}
          className="rounded-xl bg-purple-600 px-6 py-3 text-xs font-black uppercase tracking-widest text-white"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <div className="app-shell pb-24 safe-top">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <ScreenTitle title="Perfil" />
        <div className="flex gap-2">
            <button
                onClick={() => setEditOpen(true)}
                className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground active:scale-95 transition-transform"
                aria-label="Editar perfil"
            >
                <Pencil size={18} />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground active:scale-95 transition-transform"
              aria-label="Configurações"
            >
                <Settings size={20} />
            </button>
        </div>
      </header>

      {/* Desktop: perfil + progresso à esquerda, histórico à direita, conquistas
          e conta em largura total. No celular a ordem do DOM continua a mesma. */}
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8 lg:px-6">
      <div>
      {/* Hero Section */}
      <section className="px-6 mt-8 flex flex-col items-center text-center lg:px-0">
        <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative rounded-[2.4rem] border border-purple-500/20 bg-purple-500/10 p-1 shadow-card"
        >
            <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="block w-32 h-32 cursor-pointer relative group overflow-hidden rounded-3xl bg-card border border-border"
                aria-label="Alterar foto de perfil"
            >
                {profile?.photoURL || user?.photoURL ? (
                    <img src={profile?.photoURL || user?.photoURL || ""} className="w-full h-full object-cover transition-all group-hover:opacity-40 group-hover:blur-[2px]" alt="avatar" />
                ) : (
                    <span className="text-4xl font-black font-display text-purple-500 w-full h-full flex items-center justify-center transition-all group-hover:opacity-40">{initials}</span>
                )}

                <div className="absolute inset-0 hidden group-hover:flex items-center justify-center">
                    <Camera size={32} className="text-foreground drop-shadow-md" />
                </div>
            </button>
            <div className="absolute -bottom-2 left-1/2 bg-purple-600 px-4 py-1 rounded-full text-[10px] font-black tracking-widest border-2 border-background -translate-x-1/2 shadow-card whitespace-nowrap z-10 text-white">
                LEVEL {levelInfo.currentLevel.toUpperCase()}
            </div>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.35 }}
          className="mt-8 font-display font-black text-3xl tracking-tighter uppercase"
        >
          {displayName}
        </motion.h2>
        <div className="mt-3 flex items-center gap-1.5 rounded-full bg-card border border-border px-3 py-1.5 text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
            <MapPin size={12} className="text-purple-500" />
            {profile?.location || "São Paulo, SP"}
        </div>
        <p className="mt-6 text-sm text-muted-foreground max-w-xs leading-relaxed">
            {profile?.bio || "Apaixonado por corrida e desafios urbanos."}
        </p>
      </section>

      {/* Progresso: numeros principais, pet, metas e nivel agrupados sob um unico titulo */}
      <section className="px-6 mt-8 lg:px-0">
        <button onClick={() => navigate("/calendario-treinos")} className="flex w-full items-center gap-3 rounded-3xl border border-border bg-card p-4 text-left">
          <Calendar className="text-primary" size={22} /><div className="flex-1"><p className="text-sm font-black">Calendário de treinos</p><p className="mt-1 text-xs text-muted-foreground">Planeje suas corridas e acompanhe sua agenda</p></div><ChevronRight size={18} />
        </button>
      </section>
      <section className="px-6 mt-10 lg:px-0">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display font-black text-sm tracking-tighter">SEU PROGRESSO</h3>
        </div>

        {features.sleep && (
          <button onClick={() => navigate("/sono")} className="mb-4 flex w-full items-center gap-3 rounded-3xl border border-border bg-card/80 p-4 text-left transition hover:bg-secondary">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Moon size={22} /></div>
            <div className="flex-1"><p className="text-sm font-black">Sono e recuperação</p><p className="mt-1 text-xs text-muted-foreground">Acompanhe seu descanso junto aos treinos</p></div>
            <ChevronRight size={18} className="text-muted-foreground" />
          </button>
        )}

        <button
          onClick={() => navigate("/pet")}
          className="mb-4 flex w-full items-center gap-3 rounded-3xl bg-card border border-border p-4 text-left active:scale-[0.98] transition-transform"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/20 text-2xl">
            {petSpeciesInfo ? <img src={petSpeciesInfo.image} alt={petSpeciesInfo.label} className="h-full w-full object-contain" /> : <PawPrint className="text-purple-500" size={20} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Seu pet</p>
            <p className="mt-0.5 truncate font-display text-base font-black">
              {profile?.petName || "Adote seu pet"}
            </p>
          </div>
          <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
        </button>

        <div className="grid grid-cols-2 gap-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -3 }}
                className={cn(GLASS_CARD_CLASS, "p-6 relative overflow-hidden")}
            >
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total acumulado</p>
                <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black font-display">{statsData?.totalKm || "0.0"}</span>
                    <span className="text-xs font-bold text-purple-500">KM</span>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                whileHover={{ y: -3 }}
                className={cn(GLASS_CARD_CLASS, "p-6 relative overflow-hidden")}
            >
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">XP Total</p>
                <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black font-display">{profile?.totalXP?.toLocaleString("pt-BR") || "0"}</span>
                    <span className="text-xs font-bold text-orange-500 uppercase">XP</span>
                </div>
            </motion.div>
        </div>

        {/* Metas e nivel: duas barras de progresso, um card so */}
        <div className={cn(GLASS_CARD_CLASS, "mt-4 p-5")}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Meta semanal</p>
              <h3 className="mt-1 font-display text-xl font-black">
                {weeklyKm.toFixed(1)} / {weeklyGoalKm.toFixed(1)} km
              </h3>
            </div>
            <Zap size={20} className="text-purple-500" />
          </div>
          <div className="mt-3 h-3 rounded-full bg-background/80 p-1 border border-border">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${weeklyProgress}%` }}
              className="h-full rounded-full bg-purple-500"
            />
          </div>
          <button
            onClick={() => setEditOpen(true)}
            className="mt-3 text-[10px] font-black uppercase tracking-widest text-purple-400"
          >
            Ajustar meta
          </button>

          <div className="my-5 border-t border-border" />

          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Nível</p>
            <span className="text-xs font-black text-purple-500 uppercase">{levelInfo.currentLevel} → {levelInfo.nextLevel}</span>
          </div>
          <div className="mt-3 h-3 rounded-full bg-background/80 p-1 border border-border">
            <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${levelInfo.progress}%` }}
                className="h-full rounded-full bg-gradient-to-r from-purple-600 to-purple-400"
            />
          </div>
          <p className="mt-3 text-[10px] font-bold text-muted-foreground/70">
            {levelInfo.xpToNext > 0
              ? `Faltam ${levelInfo.xpToNext.toLocaleString("pt-BR")} XP para se tornar ${levelInfo.nextLevel.toUpperCase()}`
              : "Você atingiu o nível máximo!"}
          </p>
        </div>

        {features.healthConnectRuns && (
          <button onClick={() => navigate("/dispositivos")} className="mt-4 flex w-full items-center gap-4 rounded-3xl border border-border bg-card p-5 text-left">
            <Watch size={24} className="shrink-0 text-purple-500" />
            <div className="flex-1"><h3 className="font-display text-xl font-black">Dispositivos conectados</h3><p className="mt-1 text-xs text-muted-foreground">Conectar Health Connect e importar corridas do relógio.</p></div>
            <ChevronRight size={20} className="text-muted-foreground" />
          </button>
        )}
        {/* Entrada: status completo, mesmo padrao visual de linha com chevron */}
        <button onClick={() => navigate("/tenis")} className="mt-4 flex w-full items-center gap-4 rounded-3xl border border-border bg-card p-5 text-left">
          <Footprints size={24} className="shrink-0 text-purple-500" />
          <div className="flex-1"><h3 className="font-display text-xl font-black">Meus tênis</h3><p className="mt-1 text-xs text-muted-foreground">Quilometragem, desgaste e tênis usados nas corridas.</p></div>
          <ChevronRight size={20} className="text-muted-foreground" />
        </button>
        <div className="mt-4">
          <button
            onClick={() => navigate("/stats")}
            className="bg-card border border-border w-full rounded-3xl p-5 text-left transition active:scale-[0.98]"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Status completo</p>
                <h3 className="mt-1 font-display text-xl font-black">Informacoes da corrida</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Ritmo medio, melhor corrida, sequencia, calorias e progresso semanal.
                </p>
              </div>
              <div className="bg-purple-600 text-white flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
                <BarChart3 size={22} />
              </div>
            </div>
          </button>
        </div>
      </section>

      </div>

      {/* Achievements Horizontal */}
      <section className="mt-10 lg:col-span-2">
          <div className="px-6 flex items-center justify-between mb-4">
            <h3 className="font-display font-black text-sm tracking-tighter">CONQUISTAS</h3>
            <button onClick={() => navigate("/conquistas")} className="text-[10px] font-black text-purple-500">VER TODAS</button>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar px-6">
              {realAchievements.map((a, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.08 }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className={cn(GLASS_CARD_CLASS, "min-w-[150px] p-5 flex flex-col items-center gap-3", !a.unlocked && "opacity-45")}
                >
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/15 flex items-center justify-center text-purple-500 shadow-[0_0_18px_rgba(147,51,234,0.14)]">
                        {a.icon}
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] font-black leading-tight uppercase">{a.name}</p>
                        <p className="text-[8px] font-bold text-muted-foreground/70 mt-1">{a.detail}</p>
                    </div>
                </motion.div>
              ))}
          </div>
      </section>

      <section className="px-6 mt-10 lg:col-start-2 lg:row-start-1 lg:mt-8 lg:px-0">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-black text-sm tracking-tighter">HISTÓRICO</h3>
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
            {runHistory.length} corridas
          </span>
        </div>
        <div className="space-y-3">
          {runHistory.length === 0 ? (
            <div className={cn(GLASS_CARD_CLASS, "p-8 text-center")}>
              <Calendar size={32} className="mx-auto text-muted-foreground/50" />
              <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Nenhuma corrida no histórico</p>
            </div>
          ) : (
            runHistory.map((run) => (
              <RunHistoryRow key={run.id} run={run} dateLabel={formatRunHistoryDate(run)} />
            ))
          )}
        </div>
      </section>

      {/* Conta */}
      <section className="px-6 mt-10 pb-6 lg:col-span-2 lg:px-0">
        <h3 className="mb-4 font-display font-black text-sm tracking-tighter">CONTA</h3>
        <button
            onClick={handleLogout}
            className="w-full bg-card border border-border py-4 rounded-xl text-[10px] font-black tracking-widest text-muted-foreground hover:text-red-500 hover:border-red-500/30 transition-all flex items-center justify-center gap-2"
        >
            <LogOut size={16} />
            SAIR DA CONTA
        </button>
      </section>
      </div>

      <EditProfileModal
        open={editOpen} 
        onClose={() => setEditOpen(false)} 
        initialData={{
          bio: profile?.bio || "",
          location: profile?.location || "",
          photoURL: profile?.photoURL || user?.photoURL || "",
          weeklyGoalKm: profile?.weeklyGoalKm ?? 10,
        }}
        onSuccess={fetchProfileData}
        user={user}
      />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onThemeChange={handleThemeChange}
        user={user}
        onActivitiesDeleted={fetchProfileData}
        privateProfile={Boolean(profile?.privateProfile)}
        onPrivacyChange={handlePrivacyChange}
      />
    </div>
  );
};

export default Profile;
