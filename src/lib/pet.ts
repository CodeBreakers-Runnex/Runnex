import type { PetAccessorySlot, PetSpecies } from "@/types";

export interface PetSpeciesInfo {
  id: PetSpecies;
  label: string;
  emoji: string;
}

// 5 espécies, todas ligadas ao tema velocidade.
export const PET_SPECIES: PetSpeciesInfo[] = [
  { id: "guepardo", label: "Guepardo", emoji: "🐆" },
  { id: "lebre", label: "Lebre", emoji: "🐇" },
  { id: "cavalo", label: "Cavalo", emoji: "🐎" },
  { id: "falcao", label: "Falcão", emoji: "🦅" },
  { id: "galgo", label: "Galgo", emoji: "🐕" },
];

export function getPetSpeciesInfo(species: PetSpecies | undefined | null): PetSpeciesInfo | null {
  return PET_SPECIES.find((item) => item.id === species) || null;
}

export interface PetAccessory {
  id: string;
  label: string;
  slot: PetAccessorySlot;
  emoji: string;
  source: "achievement" | "store";
  /** Presente quando source === "achievement": id em ACHIEVEMENTS (lib/achievements.ts). */
  achievementId?: string;
  /** Presente quando source === "store": preço em RunCoin. */
  price?: number;
}

export const ACCESSORY_SLOTS: { id: PetAccessorySlot; label: string }[] = [
  { id: "cabeca", label: "Cabeça" },
  { id: "pescoco", label: "Pescoço" },
  { id: "fundo", label: "Fundo" },
];

export const PET_ACCESSORIES: PetAccessory[] = [
  // Desbloqueados por conquista (ver lib/achievements.ts)
  { id: "acc-primeira-corrida", label: "Lenço de estreia", slot: "pescoco", emoji: "🎽", source: "achievement", achievementId: "primeira-corrida" },
  { id: "acc-5k", label: "Boné 5K", slot: "cabeca", emoji: "🧢", source: "achievement", achievementId: "5k-completo" },
  { id: "acc-25km", label: "Paisagem 25K", slot: "fundo", emoji: "🌄", source: "achievement", achievementId: "25km-acumulados" },
  { id: "acc-streak3", label: "Coleira de fogo", slot: "pescoco", emoji: "🔥", source: "achievement", achievementId: "sequencia-3-dias" },
  { id: "acc-250km", label: "Cenário montanhas", slot: "fundo", emoji: "🏔️", source: "achievement", achievementId: "250km-acumulados" },
  { id: "acc-1hora", label: "Viseira cronometrada", slot: "cabeca", emoji: "⏱️", source: "achievement", achievementId: "uma-hora-corrida" },
  { id: "acc-sub10k", label: "Óculos de velocidade", slot: "cabeca", emoji: "🥽", source: "achievement", achievementId: "sub-10k" },
  { id: "acc-100treinos", label: "Medalha de veterano", slot: "pescoco", emoji: "🎖️", source: "achievement", achievementId: "100-treinos" },
  { id: "acc-metabatida", label: "Bandeira de chegada", slot: "fundo", emoji: "🏁", source: "achievement", achievementId: "meta-semanal-batida" },
  { id: "acc-amanheceres", label: "Amanhecer dourado", slot: "fundo", emoji: "🌅", source: "achievement", achievementId: "dez-amanheceres" },
  { id: "acc-noites", label: "Céu noturno", slot: "fundo", emoji: "🌙", source: "achievement", achievementId: "dez-noites" },
  { id: "acc-1ano", label: "Coroa do ano", slot: "cabeca", emoji: "👑", source: "achievement", achievementId: "um-ano-ativo" },

  // Comprados na loja com RunCoin
  { id: "store-cartola", label: "Cartola clássica", slot: "cabeca", emoji: "🎩", source: "store", price: 80 },
  { id: "store-oculos", label: "Óculos escuros", slot: "cabeca", emoji: "🕶️", source: "store", price: 60 },
  { id: "store-cachecol", label: "Cachecol", slot: "pescoco", emoji: "🧣", source: "store", price: 50 },
  { id: "store-laco", label: "Laço", slot: "pescoco", emoji: "🎀", source: "store", price: 40 },
  { id: "store-skyline", label: "Skyline noturno", slot: "fundo", emoji: "🌆", source: "store", price: 100 },
  { id: "store-arcoiris", label: "Arco-íris", slot: "fundo", emoji: "🌈", source: "store", price: 70 },
];

export function getAccessoryById(id: string | null | undefined): PetAccessory | null {
  if (!id) return null;
  return PET_ACCESSORIES.find((accessory) => accessory.id === id) || null;
}

export type PetMood = "feliz" | "cansado" | "triste";

// Humor do pet reflete a sequência de dias correndo (mesma streak do resto do app).
export function getPetMood(currentStreak: number): PetMood {
  if (currentStreak >= 3) return "feliz";
  if (currentStreak >= 1) return "cansado";
  return "triste";
}

export const PET_MOOD_LABEL: Record<PetMood, string> = {
  feliz: "Feliz e ativo",
  cansado: "Precisa de uma corrida",
  triste: "Sentindo sua falta",
};
