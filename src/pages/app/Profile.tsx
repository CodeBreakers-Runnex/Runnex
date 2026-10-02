import { useState, useEffect, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { updateProfile, User } from "firebase/auth";
import { auth } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Settings,
  ChevronRight,
  MapPin,
  Calendar,
  Pencil,
  X,
  LogOut,
  Camera,
  Loader2,
  Zap,
  Moon,
  Sun,
  Shield,
  Ruler,
  Lock,
  Trash2,
  BarChart3,
  PawPrint,
} from "lucide-react";
import { createUserProfile, deleteUserActivities, getUserActivities, getUserStats, getUserProfile, UserProfile, UserStats } from "@/services/database";
import type { FeedActivity } from "@/types";
import { getLevelFromXP } from "@/lib/gamification";
import { toDateSafe } from "@/lib/feed-utils";
import { resizeImageToDataUrl } from "@/lib/image-resize";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { getPetSpeciesInfo } from "@/lib/pet";
import { getStoredSettings, updateStoredSettings } from "@/lib/settings";
import type { SettingsState } from "@/lib/settings";
import { GLASS_CARD_CLASS } from "@/components/GlassCard";
import { cn } from "@/lib/utils";
import RunHistoryRow from "@/components/RunHistoryRow";
import DeleteAccountSection from "@/components/DeleteAccountSection";

type Theme = "dark" | "light";

const THEME_STORAGE_KEY = "veloxy-theme";

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

const getStoredTheme = (): Theme => {
  return localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
};

const applyTheme = (theme: Theme) => {
  document.documentElement.classList.toggle("light", theme === "light");
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(THEME_STORAGE_KEY, theme);
};

const playThemeTransition = (theme: Theme) => {
  const root = document.documentElement;
  root.classList.remove("theme-transitioning", "theme-to-light", "theme-to-dark");
  window.requestAnimationFrame(() => {
    root.classList.add("theme-transitioning");
    window.setTimeout(() => {
      root.classList.remove("theme-transitioning", "theme-to-light", "theme-to-dark");
    }, 440);
  });
};

function SettingsRow({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-card/80 backdrop-blur-xl border border-border p-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="settings-title text-sm font-black text-foreground">{title}</p>
          <p className="settings-muted text-[10px] text-muted-foreground leading-snug mt-0.5">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`h-7 w-12 rounded-full p-1 transition-colors ${checked ? "bg-purple-600" : "bg-secondary"}`}
    >
      <span
        className={`block h-5 w-5 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  );
}

function SettingsModal({
  open,
  onClose,
  theme,
  onThemeChange,
  user,
  onActivitiesDeleted,
  privateProfile,
  onPrivacyChange,
}: {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  user: User | null;
  onActivitiesDeleted: () => void;
  privateProfile: boolean;
  onPrivacyChange: (value: boolean) => Promise<void>;
}) {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<SettingsState>(getStoredSettings);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingRuns, setDeletingRuns] = useState(false);

  const updateSetting = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings(updateStoredSettings(key, value));
  };

  useEffect(() => {
    setSettings((prev) => ({ ...prev, privateProfile }));
  }, [privateProfile]);

  const updatePrivacy = async (value: boolean) => {
    updateSetting("privateProfile", value);
    await onPrivacyChange(value);
  };

  const handleDeleteRuns = async () => {
    if (!user) return;

    if (!confirmDelete) {
      setConfirmDelete(true);
      toast.warning("Toque novamente para confirmar a exclusão das corridas.");
      return;
    }

    setDeletingRuns(true);
    try {
      const deletedCount = await deleteUserActivities(user.uid);
      toast.success(`${deletedCount} corrida${deletedCount === 1 ? "" : "s"} apagada${deletedCount === 1 ? "" : "s"}.`);
      setConfirmDelete(false);
      onActivitiesDeleted();
    } catch (error) {
      console.error("Erro ao apagar corridas:", error);
      toast.error("Não foi possível apagar as corridas.");
    } finally {
      setDeletingRuns(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-md z-50"
          />
          <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ type: "spring", damping: 30, stiffness: 400 }}
            className={cn(GLASS_CARD_CLASS, "w-full max-w-lg max-h-[82svh] overflow-hidden p-5 shadow-2xl pointer-events-auto")}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Veloxy</p>
                <h2 className="font-display text-2xl font-black text-purple-500">CONFIGURAÇÕES</h2>
              </div>
              <button onClick={onClose} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground" aria-label="Fechar">
                <X size={20} />
              </button>
            </div>

            <div className="max-h-[calc(82svh-7rem)] overflow-y-auto no-scrollbar space-y-3 pb-1">
              <SettingsRow icon={theme === "light" ? <Sun size={18} /> : <Moon size={18} />} title="Tema do app" description="Escolha como o Veloxy aparece na tela.">
                <div className="relative flex rounded-2xl bg-background/50 border border-border p-1">
                  {(["dark", "light"] as Theme[]).map((option) => (
                    <button
                      key={option}
                      onClick={() => onThemeChange(option)}
                      className={`relative px-3 py-2 rounded-xl text-[10px] font-black uppercase transition ${
                        theme === option ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {theme === option && (
                        <motion.span
                          layoutId="theme-switch-pill"
                          className="absolute inset-0 rounded-xl bg-purple-600 shadow-[0_0_16px_rgba(147,51,234,0.45)]"
                          transition={{ type: "spring", stiffness: 420, damping: 32 }}
                        />
                      )}
                      <motion.span
                        className="relative z-10"
                        animate={{ scale: theme === option ? 1.03 : 1 }}
                        transition={{ duration: 0.18 }}
                      >
                        {option === "dark" ? "Dark" : "Light"}
                      </motion.span>
                    </button>
                  ))}
                </div>
              </SettingsRow>

              <SettingsRow icon={<Shield size={18} />} title="Perfil privado" description="Oculta seu perfil dos rankings públicos.">
                <ToggleSwitch checked={settings.privateProfile} onChange={updatePrivacy} />
              </SettingsRow>

              <SettingsRow icon={<Ruler size={18} />} title="Unidade de distância" description="Define a unidade preferida para corridas.">
                <div className="flex rounded-2xl bg-background/50 border border-border p-1">
                  {(["km", "mi"] as const).map((unit) => (
                    <button
                      key={unit}
                      onClick={() => updateSetting("units", unit)}
                      className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition ${
                        settings.units === unit ? "bg-purple-600 text-white" : "text-muted-foreground"
                      }`}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              </SettingsRow>

              <div className="pt-2">
                <button
                  onClick={() => navigate("/termos-e-privacidade")}
                  className={cn(GLASS_CARD_CLASS, "w-full rounded-2xl p-4 text-left")}
                >
                  <Lock size={18} className="text-purple-500 mb-3" />
                  <p className="settings-title text-xs font-black text-foreground">Privacidade</p>
                  <p className="settings-muted text-[10px] text-muted-foreground mt-1">Termos de uso e política de privacidade</p>
                </button>
              </div>

              <div className="pt-4">
                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.25em] text-red-400">
                  Zona de risco
                </p>
                <button
                  onClick={handleDeleteRuns}
                  disabled={deletingRuns}
                  className={`settings-danger-action w-full rounded-2xl border p-4 text-left transition disabled:opacity-60 ${
                    confirmDelete
                      ? "border-red-500/60 bg-red-500/10 text-red-400"
                      : "border-border bg-card/80 backdrop-blur-xl text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center">
                      {deletingRuns ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                    </div>
                    <div>
                      <p className="settings-danger-title text-sm font-black">
                        {confirmDelete ? "Confirmar exclusão" : "Apagar minhas corridas"}
                      </p>
                      <p className="settings-muted text-[10px] text-muted-foreground mt-0.5">
                        Remove atividades salvas e zera km/XP do perfil.
                      </p>
                    </div>
                  </div>
                </button>
                {user && (
                  <div className="mt-3">
                    <DeleteAccountSection user={user} />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ===================== EDIT PROFILE MODAL ===================== */
function EditProfileModal({
  open,
  onClose,
  initialData,
  onSuccess,
  user
}: {
  open: boolean;
  onClose: () => void;
  initialData: { bio: string; location: string; photoURL: string; weeklyGoalKm: number };
  onSuccess: () => void;
  user: User | null;
}) {
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [saving, setSaving] = useState(false);
  const [location, setLocation] = useState(initialData.location);
  const [bio, setBio] = useState(initialData.bio);
  const [photoURL, setPhotoURL] = useState(initialData.photoURL);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [weeklyGoalKm, setWeeklyGoalKm] = useState(initialData.weeklyGoalKm.toString());
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setDisplayName(user?.displayName || "");
    setLocation(initialData.location);
    setBio(initialData.bio);
    setPhotoURL(initialData.photoURL);
    setWeeklyGoalKm(initialData.weeklyGoalKm.toString());
  }, [open, initialData, user]);

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;

    setUploadingPhoto(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setPhotoURL(dataUrl);
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível processar a foto agora.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      toast.error("O nome não pode ficar vazio");
      return;
    }
    setSaving(true);
    try {
      if (user) {
        const goalValue = Number(weeklyGoalKm);
        const trimmedPhoto = photoURL.trim();
        // Firebase Auth so aceita URL http(s) de verdade em photoURL — uma
        // foto local vira base64 (data:...), que ele rejeita. O Postgres
        // (fonte de verdade pra exibir a foto no app) aceita qualquer string.
        await updateProfile(user, {
          displayName: displayName.trim(),
          ...(trimmedPhoto.startsWith("data:") ? {} : { photoURL: trimmedPhoto || null }),
        });

        await createUserProfile(user.uid, {
          displayName: displayName.trim(),
          photoURL: trimmedPhoto || null,
          bio: bio.trim(),
          location: location.trim(),
          weeklyGoalKm: Number.isFinite(goalValue) ? Math.max(0, Math.min(goalValue, 500)) : 10,
        });
      }
      toast.success("Perfil atualizado!");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error("Erro ao atualizar perfil");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 transition-all"
          />
          <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ type: "spring", damping: 30, stiffness: 400 }}
            className={cn(GLASS_CARD_CLASS, "w-full max-w-lg max-h-[82svh] overflow-hidden p-6 shadow-2xl pointer-events-auto")}
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-display text-2xl font-black text-purple-500">EDITAR PERFIL</h2>
              <button onClick={onClose} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground" aria-label="Fechar">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-6 max-h-[calc(82svh-9rem)] overflow-y-auto no-scrollbar pb-4">
                  <div className="flex flex-col items-center">
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="relative block h-24 w-24 cursor-pointer overflow-hidden rounded-3xl border border-border bg-secondary group disabled:opacity-70"
                      aria-label="Trocar foto de perfil"
                    >
                      {photoURL ? (
                        <img src={photoURL} className="h-full w-full object-cover transition-all group-hover:opacity-40" alt="Foto de perfil" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center font-display text-2xl font-black text-purple-500">
                          {(displayName || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                        {uploadingPhoto ? <Loader2 size={22} className="animate-spin text-white" /> : <Camera size={22} className="text-white" />}
                      </div>
                    </button>
                    <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Toque para trocar a foto</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 block">Nome de Corredor</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-secondary border border-input rounded-xl px-5 py-4 text-sm outline-none focus:border-purple-500 transition"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 block">Localização</label>
                    <input
                      type="text"
                      placeholder="Ex: São Paulo, SP"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full bg-secondary border border-input rounded-xl px-5 py-4 text-sm outline-none focus:border-purple-500 transition"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 block">Meta semanal (km)</label>
                    <input
                      type="number"
                      min="0"
                      max="500"
                      step="0.5"
                      value={weeklyGoalKm}
                      onChange={(e) => setWeeklyGoalKm(e.target.value)}
                      className="w-full bg-secondary border border-input rounded-xl px-5 py-4 text-sm outline-none focus:border-purple-500 transition"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 block">Minha Bio</label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={3}
                      className="w-full bg-secondary border border-input rounded-xl px-5 py-4 text-sm outline-none focus:border-purple-500 transition resize-none"
                    />
                  </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleSave}
              disabled={saving || uploadingPhoto}
              className="w-full mt-4 bg-purple-600 hover:bg-purple-700 transition py-5 rounded-xl font-black tracking-widest text-sm disabled:opacity-50"
            >
              {saving ? "SALVANDO..." : "SALVAR ALTERAÇÕES"}
            </motion.button>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
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

  const fetchProfileData = useCallback(async () => {
    if (!user) return;
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
      console.error("Erro ao carregar perfil:", error);
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

  return (
    <div className="app-shell pb-24 safe-top">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-xl border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <h1 className="font-display font-black text-2xl tracking-tighter text-purple-500">
          VELOXY PROFILE
        </h1>
        <div className="flex gap-2">
            <button
                onClick={() => setEditOpen(true)}
                className="w-10 h-10 rounded-full bg-card/80 backdrop-blur-xl border border-border flex items-center justify-center text-muted-foreground active:scale-95 transition-transform"
                aria-label="Editar perfil"
            >
                <Pencil size={18} />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="w-10 h-10 rounded-full bg-card/80 backdrop-blur-xl border border-border flex items-center justify-center text-muted-foreground active:scale-95 transition-transform"
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
                className="block w-32 h-32 cursor-pointer relative group overflow-hidden rounded-3xl bg-card/80 backdrop-blur-xl border border-border"
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
        <div className="mt-3 flex items-center gap-1.5 rounded-full bg-card/80 backdrop-blur-xl border border-border px-3 py-1.5 text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
            <MapPin size={12} className="text-purple-500" />
            {profile?.location || "São Paulo, SP"}
        </div>
        <p className="mt-6 text-sm text-muted-foreground max-w-xs leading-relaxed">
            {profile?.bio || "Apaixonado por corrida e desafios urbanos."}
        </p>
      </section>

      {/* Progresso: numeros principais, pet, metas e nivel agrupados sob um unico titulo */}
      <section className="px-6 mt-10 lg:px-0">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display font-black text-sm tracking-tighter">SEU PROGRESSO</h3>
        </div>

        <button
          onClick={() => navigate("/pet")}
          className="mb-4 flex w-full items-center gap-3 rounded-3xl bg-card/80 backdrop-blur-xl border border-border p-4 text-left active:scale-[0.98] transition-transform"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/20 text-2xl">
            {petSpeciesInfo?.emoji || <PawPrint className="text-purple-500" size={20} />}
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

        {/* Entrada: status completo, mesmo padrao visual de linha com chevron */}
        <div className="mt-4">
          <button
            onClick={() => navigate("/stats")}
            className="bg-card/80 backdrop-blur-xl border border-border w-full rounded-3xl p-5 text-left transition active:scale-[0.98]"
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
            className="w-full bg-card/80 backdrop-blur-xl border border-border py-4 rounded-xl text-[10px] font-black tracking-widest text-muted-foreground hover:text-red-500 hover:border-red-500/30 transition-all flex items-center justify-center gap-2"
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
