import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { updateProfile } from "firebase/auth";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { User, MapPin, Pencil, Loader2, ChevronRight, Camera } from "lucide-react";
import logo from "@/assets/LogoNova-login.png";
import { createUserProfile } from "@/services/database";
import { resizeImageToDataUrl } from "@/lib/image-resize";

export default function CompleteProfile() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState(user?.displayName || "");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoURL, setPhotoURL] = useState(user?.photoURL || "");

  // Rota só faz sentido para quem acabou de se cadastrar/logar; sem sessão,
  // manda para o login em vez de deixar o formulário "salvar" sem efeito.
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [authLoading, user, navigate]);

  const handleComplete = async () => {
    if (!user) {
      toast.error("Sua sessão ainda está carregando. Tente novamente em instantes.");
      return;
    }

    if (!username.trim()) {
      toast.error("Escolha um nome de corredor");
      return;
    }

    setSaving(true);
    try {
      const normalizedPhoto = photoURL.trim();
      // Firebase Auth so aceita URL http(s) de verdade em photoURL — uma
      // foto local vira base64 (data:...), que ele rejeita. O Postgres
      // (fonte de verdade pra exibir a foto no app) aceita qualquer string.
      await updateProfile(user, {
        displayName: username.trim(),
        photoURL: normalizedPhoto.startsWith("data:") ? null : normalizedPhoto || null,
      });

      await createUserProfile(user.uid, {
        displayName: username.trim(),
        photoURL: normalizedPhoto || null,
        location: location.trim(),
        bio: bio.trim(),
        onboarded: true,
      });

      toast.success(`Bem-vindo ao Veloxy, ${username}! 🏃‍♂️`);
      navigate("/");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo depois

    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Escolha um arquivo de imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter até 5MB.");
      return;
    }

    setUploadingPhoto(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setPhotoURL(dataUrl);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao processar a foto. Tente novamente.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSkip = async () => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      await createUserProfile(user.uid, { onboarded: true });
    } catch (err) {
      console.error(err);
    }
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-foreground">
      {/* Logo pequena */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <img src={logo} alt="Veloxy" className="w-24 h-20 object-contain" />
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center mb-8"
      >
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">
          Quase lá! 🎉
        </h1>
        <p className="text-gray-400 text-sm max-w-xs">
          Complete seu perfil para personalizar sua experiência no Veloxy
        </p>
      </motion.div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="w-full max-w-sm space-y-4"
      >
        {/* Avatar preview */}
        <div className="flex flex-col items-center gap-2 mb-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
            className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center ring-2 ring-purple-500/30 ring-offset-2 ring-offset-black relative overflow-hidden shadow-lg group disabled:opacity-70"
          >
            {photoURL ? (
               <img src={photoURL} alt="Avatar Preview" className="w-full h-full object-cover" />
            ) : (
               <span className="text-3xl font-display font-bold text-white z-10">
                 {username ? username.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "?"}
               </span>
            )}

            <div
              className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity ${
                photoURL ? "opacity-0 group-hover:opacity-100" : "opacity-100"
              }`}
            >
              {uploadingPhoto ? (
                <Loader2 size={24} className="text-white animate-spin" />
              ) : (
                <Camera size={24} className="text-foreground opacity-90" />
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setPhotoURL(user?.photoURL || "")}
            className="text-[10px] font-bold text-purple-400"
          >
            usar foto do Google
          </button>
        </div>

        {/* Username */}
        <div>
          <label className="text-xs text-gray-400 font-medium mb-1.5 flex items-center gap-1.5">
            <User size={12} />
            Nome de Corredor *
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Escolha seu nome ou apelido"
            className="w-full bg-secondary border border-input rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-gray-500 outline-none focus:border-purple-500 transition"
          />
        </div>

        {/* Location */}
        <div>
          <label className="text-xs text-gray-400 font-medium mb-1.5 flex items-center gap-1.5">
            <MapPin size={12} />
            Localização (opcional)
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Ex: São Paulo, SP"
            className="w-full bg-secondary border border-input rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-gray-500 outline-none focus:border-purple-500 transition"
          />
        </div>

        {/* Bio */}
        <div>
          <label className="text-xs text-gray-400 font-medium mb-1.5 flex items-center gap-1.5">
            <Pencil size={12} />
            Bio (opcional)
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Conte um pouco sobre você como corredor..."
            rows={2}
            maxLength={150}
            className="w-full bg-secondary border border-input rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-gray-500 outline-none focus:border-purple-500 transition resize-none"
          />
          <p className="text-[10px] text-gray-600 text-right mt-0.5">
            {bio.length}/150
          </p>
        </div>

        {/* Complete Button */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.02 }}
          onClick={handleComplete}
          disabled={saving || uploadingPhoto}
          className="w-full bg-purple-600 hover:bg-purple-700 transition py-3.5 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              Começar a correr
              <ChevronRight size={18} />
            </>
          )}
        </motion.button>

        {/* Skip */}
        <button
          onClick={handleSkip}
          className="w-full text-center text-xs text-gray-500 hover:text-gray-300 transition-colors py-2"
        >
          Pular por agora
        </button>
      </motion.div>
    </div>
  );
}
