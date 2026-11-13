// Modal de edição do perfil (antes dentro de Profile.tsx).
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { updateProfile, User } from "firebase/auth";
import { toast } from "sonner";
import { X, Camera, Loader2 } from "lucide-react";
import { createUserProfile } from "@/services/database";
import { resizeImageToDataUrl } from "@/lib/image-resize";
import { GLASS_CARD_CLASS } from "@/components/GlassCard";
import { cn } from "@/lib/utils";
import { useBackHandler } from "@/hooks/useBackHandler";

export default function EditProfileModal({
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
  useBackHandler(open, () => { if (!saving && !uploadingPhoto) onClose(); });
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
                    <label htmlFor="edit-profile-name" className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 block">Nome de Corredor</label>
                    <input
                      id="edit-profile-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-secondary border border-input rounded-xl px-5 py-4 text-sm outline-none focus:border-purple-500 transition"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-profile-location" className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 block">Localização</label>
                    <input
                      id="edit-profile-location"
                      type="text"
                      placeholder="Ex: São Paulo, SP"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full bg-secondary border border-input rounded-xl px-5 py-4 text-sm outline-none focus:border-purple-500 transition"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-profile-goal" className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 block">Meta semanal (km)</label>
                    <input
                      id="edit-profile-goal"
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
                    <label htmlFor="edit-profile-bio" className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 block">Minha Bio</label>
                    <textarea
                      id="edit-profile-bio"
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
