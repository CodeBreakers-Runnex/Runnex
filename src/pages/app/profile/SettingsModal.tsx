// Modal de configurações do perfil (antes dentro de Profile.tsx).
import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { User } from "firebase/auth";
import { toast } from "sonner";
import {
  X,
  Loader2,
  Moon,
  Sun,
  Shield,
  Ruler,
  Lock,
  Trash2,
} from "lucide-react";
import { deleteUserActivities } from "@/services/database";
import { getStoredSettings, updateStoredSettings } from "@/lib/settings";
import type { SettingsState } from "@/lib/settings";
import { GLASS_CARD_CLASS } from "@/components/GlassCard";
import { cn } from "@/lib/utils";
import DeleteAccountSection from "@/components/DeleteAccountSection";
import ExportDataButton from "@/components/ExportDataButton";
import { useBackHandler } from "@/hooks/useBackHandler";
import type { Theme } from "@/pages/app/profile/theme";

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
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-card border border-border p-4">
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

export default function SettingsModal({
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
  useBackHandler(open, onClose);
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
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Runnex</p>
                <h2 className="font-display text-2xl font-black text-purple-500">CONFIGURAÇÕES</h2>
              </div>
              <button onClick={onClose} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground" aria-label="Fechar">
                <X size={20} />
              </button>
            </div>

            <div className="max-h-[calc(82svh-7rem)] overflow-y-auto no-scrollbar space-y-3 pb-1">
              <SettingsRow icon={theme === "light" ? <Sun size={18} /> : <Moon size={18} />} title="Tema do app" description="Escolha como o Runnex aparece na tela.">
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

              <SettingsRow icon={<Shield size={18} />} title="Perfil privado" description="Oculta seu perfil e suas corridas do feed, dos rankings e dos grupos.">
                <ToggleSwitch checked={settings.privateProfile} onChange={updatePrivacy} />
              </SettingsRow>

              <SettingsRow icon={<Ruler size={18} />} title="Unidade de distância" description="Usada nos totais da tela inicial. As demais telas mostram em km.">
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
                      : "border-border bg-card text-muted-foreground"
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
                    <ExportDataButton />
                    <div className="mt-3">
                      <DeleteAccountSection user={user} />
                    </div>
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
