import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, Loader2, Lock, ShoppingBag, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import {
  choosePet,
  equipPetAccessory,
  getUserProfile,
  getUserStats,
  purchasePetAccessory,
} from "@/services/database";
import type { PetAccessorySlot, PetSpecies, UserProfile, UserStats } from "@/types";
import { getLevelFromXP, LEVELS } from "@/lib/gamification";
import { ACHIEVEMENTS, getUnlockedAchievementIds } from "@/lib/achievements";
import {
  ACCESSORY_SLOTS,
  PET_ACCESSORIES,
  PET_SPECIES,
  PET_MOOD_LABEL,
  getAccessoryById,
  getPetMood,
  getPetSpeciesInfo,
  type PetMood,
} from "@/lib/pet";
import { GLASS_CARD_CLASS } from "@/components/GlassCard";
import { cn } from "@/lib/utils";

// Animacao de "vivo" do pet, uma por humor: feliz pula mais e mais rapido,
// cansado balanca devagar, triste quase nao se mexe (cabisbaixo).
const PET_IDLE_ANIMATION: Record<PetMood, { y: number[]; rotate: number[]; duration: number }> = {
  feliz: { y: [0, -14, 0], rotate: [-6, 6, -6], duration: 1.1 },
  cansado: { y: [0, -4, 0], rotate: [-3, 3, -3], duration: 2.2 },
  triste: { y: [0, 3, 0], rotate: [-2, 2, -2], duration: 3.4 },
};

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

type PetTab = "acessorios" | "loja";

function PetOnboarding({ onAdopt, adopting }: { onAdopt: (species: PetSpecies, name: string) => void; adopting: boolean }) {
  const [species, setSpecies] = useState<PetSpecies | null>(null);
  const [name, setName] = useState("");

  const handleSubmit = () => {
    if (!species) {
      toast.error("Escolha um pet para adotar.");
      return;
    }
    if (!name.trim()) {
      toast.error("Dê um nome ao seu pet.");
      return;
    }
    onAdopt(species, name.trim());
  };

  return (
    <div className="app-shell flex flex-col items-center px-6 pt-16 pb-10 safe-top text-center">
      <Sparkles size={36} className="text-purple-500" />
      <h1 className="mt-4 font-display text-3xl font-black uppercase tracking-tighter">Adote seu pet</h1>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        Escolha um companheiro de velocidade. Ele evolui com seu XP e fica mais feliz quanto mais você corre.
      </p>

      <div className="mt-8 grid w-full max-w-sm grid-cols-3 gap-3">
        {PET_SPECIES.map((item) => (
          <button
            key={item.id}
            onClick={() => setSpecies(item.id)}
            className={`flex flex-col items-center gap-2 rounded-2xl border p-4 transition ${
              species === item.id ? "border-purple-500 bg-purple-500/10" : "border-border bg-card/80 backdrop-blur-xl"
            }`}
          >
            <span className="text-4xl">{item.emoji}</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-foreground/80">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-8 w-full max-w-sm text-left">
        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Nome do pet</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          placeholder="Ex: Flash"
          className="w-full bg-secondary border border-input rounded-xl px-4 py-4 text-sm outline-none focus:border-purple-500 transition"
        />
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleSubmit}
        disabled={adopting}
        className="mt-8 flex w-full max-w-sm items-center justify-center gap-2 rounded-2xl bg-purple-600 hover:bg-purple-700 transition py-4 text-sm font-black uppercase tracking-widest text-white disabled:opacity-60"
      >
        {adopting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        Adotar
      </motion.button>
    </div>
  );
}

export default function Pet() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [adopting, setAdopting] = useState(false);
  const [tab, setTab] = useState<PetTab>("acessorios");
  const [busyAccessoryId, setBusyAccessoryId] = useState<string | null>(null);

  const loadPetData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(false);
    try {
      const [profileData, statsData] = await Promise.all([
        getUserProfile(user.uid),
        getUserStats(user.uid),
      ]);
      setProfile(profileData);
      setStats(statsData);
    } catch (error) {
      console.error("Erro ao carregar o pet:", error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPetData();
  }, [loadPetData]);

  const handleAdopt = async (species: PetSpecies, name: string) => {
    if (!user) return;
    setAdopting(true);
    try {
      await choosePet(user.uid, species, name);
      toast.success(`${name} agora faz parte da sua jornada!`);
      await loadPetData();
    } catch (error) {
      console.error("Erro ao adotar pet:", error);
      toast.error("Não foi possível adotar o pet agora.");
    } finally {
      setAdopting(false);
    }
  };

  const unlockedAchievementIds = useMemo(() => getUnlockedAchievementIds(stats, profile), [stats, profile]);
  const purchasedAccessoryIds = useMemo(() => profile?.petUnlockedAccessoryIds || [], [profile]);

  const equippedBySlot: Record<PetAccessorySlot, string | null> = {
    cabeca: profile?.petEquippedCabeca || null,
    pescoco: profile?.petEquippedPescoco || null,
    fundo: profile?.petEquippedFundo || null,
  };

  const isAccessoryOwned = useCallback((accessory: (typeof PET_ACCESSORIES)[number]) => {
    if (accessory.source === "achievement") {
      return Boolean(accessory.achievementId && unlockedAchievementIds.includes(accessory.achievementId));
    }
    return purchasedAccessoryIds.includes(accessory.id);
  }, [unlockedAchievementIds, purchasedAccessoryIds]);

  const handleToggleEquip = async (accessory: (typeof PET_ACCESSORIES)[number]) => {
    if (!user) return;
    const currentlyEquipped = equippedBySlot[accessory.slot] === accessory.id;
    setBusyAccessoryId(accessory.id);
    try {
      await equipPetAccessory(user.uid, accessory.slot, currentlyEquipped ? null : accessory.id);
      setProfile((prev) => prev ? {
        ...prev,
        petEquippedCabeca: accessory.slot === "cabeca" ? (currentlyEquipped ? null : accessory.id) : prev.petEquippedCabeca,
        petEquippedPescoco: accessory.slot === "pescoco" ? (currentlyEquipped ? null : accessory.id) : prev.petEquippedPescoco,
        petEquippedFundo: accessory.slot === "fundo" ? (currentlyEquipped ? null : accessory.id) : prev.petEquippedFundo,
      } : prev);
    } catch (error) {
      console.error("Erro ao equipar acessorio:", error);
      toast.error("Não foi possível equipar agora.");
    } finally {
      setBusyAccessoryId(null);
    }
  };

  const handleBuy = async (accessory: (typeof PET_ACCESSORIES)[number]) => {
    if (!user || !accessory.price) return;
    if ((profile?.petCoins || 0) < accessory.price) {
      toast.error("RunCoins insuficientes.");
      return;
    }
    setBusyAccessoryId(accessory.id);
    try {
      await purchasePetAccessory(user.uid, accessory.id);
      toast.success(`${accessory.label} comprado!`);
      setProfile((prev) => prev ? {
        ...prev,
        petCoins: (prev.petCoins || 0) - accessory.price!,
        petUnlockedAccessoryIds: [...(prev.petUnlockedAccessoryIds || []), accessory.id],
      } : prev);
    } catch (error) {
      console.error("Erro ao comprar acessorio:", error);
      toast.error("Não foi possível comprar agora.");
    } finally {
      setBusyAccessoryId(null);
    }
  };

  if (loading) {
    return (
      <div className="app-shell flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-purple-500" size={40} />
        <p className="text-[10px] font-black text-muted-foreground tracking-[0.2em] uppercase">Carregando pet...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="app-shell flex flex-col items-center justify-center gap-5 px-6 text-center safe-top">
        <p className="font-display text-xl font-black">Erro ao carregar dados</p>
        <p className="text-sm text-muted-foreground">Não foi possível carregar seu pet agora.</p>
        <button
          onClick={loadPetData}
          className="rounded-xl bg-purple-600 hover:bg-purple-700 transition px-6 py-3 text-xs font-black uppercase tracking-widest text-white"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!profile?.petSpecies) {
    return <PetOnboarding onAdopt={handleAdopt} adopting={adopting} />;
  }

  const speciesInfo = getPetSpeciesInfo(profile.petSpecies);
  const mood = getPetMood(stats.currentStreak);
  const levelInfo = getLevelFromXP(profile.totalXP || 0);
  const stageIndex = Math.max(0, LEVELS.findIndex((level) => level.name === levelInfo.currentLevel));
  const glowSize = 12 + stageIndex * 8;
  const equippedAccessories = ACCESSORY_SLOTS
    .map((slot) => getAccessoryById(equippedBySlot[slot.id]))
    .filter((accessory): accessory is NonNullable<typeof accessory> => Boolean(accessory));

  const unlockedAccessories = PET_ACCESSORIES.filter((accessory) => accessory.source === "achievement" && isAccessoryOwned(accessory));
  const lockedAchievementAccessories = PET_ACCESSORIES.filter((accessory) => accessory.source === "achievement" && !isAccessoryOwned(accessory));
  const ownedStoreAccessories = PET_ACCESSORIES.filter((accessory) => accessory.source === "store" && isAccessoryOwned(accessory));
  const storeAccessories = PET_ACCESSORIES.filter((accessory) => accessory.source === "store" && !isAccessoryOwned(accessory));

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
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Seu pet</p>
            <h1 className="truncate font-display text-xl font-black">{profile.petName}</h1>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-purple-500/25 bg-purple-500/10 px-3 py-2 text-xs font-black text-purple-300">
            🪙 {(profile.petCoins || 0).toLocaleString("pt-BR")}
          </div>
        </div>
      </header>

      <section className="px-6 pt-8 flex flex-col items-center text-center">
        <motion.div
          animate={{ boxShadow: [
            `0 0 ${glowSize}px rgba(147,51,234,0.25)`,
            `0 0 ${glowSize * 1.4}px rgba(147,51,234,0.45)`,
            `0 0 ${glowSize}px rgba(147,51,234,0.25)`,
          ] }}
          transition={{ duration: PET_IDLE_ANIMATION[mood].duration * 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="relative flex h-40 w-40 items-center justify-center rounded-[2.5rem] border border-purple-500/25 bg-purple-500/10"
        >
          <motion.span
            className="text-7xl"
            animate={{ y: PET_IDLE_ANIMATION[mood].y, rotate: PET_IDLE_ANIMATION[mood].rotate }}
            transition={{ duration: PET_IDLE_ANIMATION[mood].duration, repeat: Infinity, ease: "easeInOut" }}
          >
            {speciesInfo?.emoji}
          </motion.span>
          {equippedAccessories.map((accessory, index) => (
            <motion.span
              key={accessory.id}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 18, delay: index * 0.08 }}
              className="absolute -bottom-2 -right-2 text-3xl drop-shadow"
              title={accessory.label}
            >
              {accessory.emoji}
            </motion.span>
          ))}
        </motion.div>

        <p className="mt-5 font-display text-2xl font-black uppercase tracking-tighter">{profile.petName}</p>
        <p className="mt-1 text-xs font-black uppercase tracking-widest text-muted-foreground">{speciesInfo?.label}</p>
        <div className="mt-3 rounded-full border border-border bg-card/80 backdrop-blur-xl px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {PET_MOOD_LABEL[mood]}
        </div>

        <div className={cn(GLASS_CARD_CLASS, "mt-6 w-full max-w-sm p-5")}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nível</p>
            <span className="text-xs font-black text-purple-400">{levelInfo.currentLevel}</span>
          </div>
          <div className="mt-2 h-3 rounded-full bg-background/80 border border-border p-0.5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${levelInfo.progress}%` }}
              className="h-full rounded-full bg-purple-500"
            />
          </div>
        </div>
      </section>

      <section className="px-6 mt-8">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setTab("acessorios")}
            className={`rounded-2xl py-3 text-xs font-black uppercase tracking-widest transition ${
              tab === "acessorios" ? "bg-purple-600 text-white" : "bg-card/80 backdrop-blur-xl border border-border text-muted-foreground"
            }`}
          >
            Acessórios
          </button>
          <button
            onClick={() => setTab("loja")}
            className={`flex items-center justify-center gap-1.5 rounded-2xl py-3 text-xs font-black uppercase tracking-widest transition ${
              tab === "loja" ? "bg-purple-600 text-white" : "bg-card/80 backdrop-blur-xl border border-border text-muted-foreground"
            }`}
          >
            <ShoppingBag size={13} />
            Loja
          </button>
        </div>
      </section>

      <AnimatePresence mode="wait">
        {tab === "acessorios" ? (
          <motion.section
            key="acessorios"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-6 mt-5 space-y-3"
          >
            {[...unlockedAccessories, ...ownedStoreAccessories].map((accessory) => (
              <AccessoryRow
                key={accessory.id}
                accessory={accessory}
                equipped={equippedBySlot[accessory.slot] === accessory.id}
                locked={false}
                busy={busyAccessoryId === accessory.id}
                onAction={() => handleToggleEquip(accessory)}
                actionLabel={equippedBySlot[accessory.slot] === accessory.id ? "Desequipar" : "Equipar"}
              />
            ))}

            {lockedAchievementAccessories.map((accessory) => {
              const achievement = ACHIEVEMENTS.find((item) => item.id === accessory.achievementId);
              return (
                <AccessoryRow
                  key={accessory.id}
                  accessory={accessory}
                  equipped={false}
                  locked
                  busy={false}
                  lockedHint={achievement ? `Conquiste "${achievement.name}"` : "Bloqueado"}
                />
              );
            })}
          </motion.section>
        ) : (
          <motion.section
            key="loja"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-6 mt-5 space-y-3"
          >
            {storeAccessories.length === 0 ? (
              <div className={cn(GLASS_CARD_CLASS, "p-8 text-center")}>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Você já tem todos os itens da loja!</p>
              </div>
            ) : (
              storeAccessories.map((accessory) => (
                <AccessoryRow
                  key={accessory.id}
                  accessory={accessory}
                  equipped={false}
                  locked={false}
                  busy={busyAccessoryId === accessory.id}
                  onAction={() => handleBuy(accessory)}
                  actionLabel={`Comprar · 🪙 ${accessory.price}`}
                  disabled={(profile.petCoins || 0) < (accessory.price || 0)}
                />
              ))
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

function AccessoryRow({
  accessory,
  equipped,
  locked,
  busy,
  onAction,
  actionLabel,
  lockedHint,
  disabled,
}: {
  accessory: (typeof PET_ACCESSORIES)[number];
  equipped: boolean;
  locked: boolean;
  busy: boolean;
  onAction?: () => void;
  actionLabel?: string;
  lockedHint?: string;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center gap-4 rounded-2xl bg-card/80 backdrop-blur-xl border p-4 ${equipped ? "border-purple-500/50" : "border-border"} ${locked ? "opacity-50" : ""}`}>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary/60 border border-input text-2xl">
        {locked ? <Lock size={18} className="text-muted-foreground" /> : accessory.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black">{accessory.label}</p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {locked ? lockedHint : ACCESSORY_SLOTS.find((slot) => slot.id === accessory.slot)?.label}
        </p>
      </div>
      {!locked && onAction && (
        <button
          onClick={onAction}
          disabled={busy || disabled}
          className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 ${
            equipped ? "bg-purple-600 text-white" : "bg-secondary border border-input text-foreground/80"
          }`}
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : equipped ? <Check size={12} /> : null}
          {actionLabel}
        </button>
      )}
    </div>
  );
}
