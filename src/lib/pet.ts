import type { PetAccessorySlot, PetSpecies } from "@/types";
import cavaloImg from "@/assets/pets/cavalo.webp";
import falcaoImg from "@/assets/pets/falcao.webp";
import guepardoImg from "@/assets/pets/guepardo.webp";
import lebreImg from "@/assets/pets/lebre.webp";
import galgoImg from "@/assets/pets/galgo.webp";
import tartarugaImg from "@/assets/pets/tartaruga.webp";

export interface PetSpeciesInfo {
  id: PetSpecies;
  label: string;
  image: string;
  /** Frase curta de personalidade, mostrada no card. */
  tagline: string;
  /** Que tipo de corredor combina com esse pet. */
  description: string;
}

// 6 espécies (5 de velocidade + a tartaruga do "devagar e sempre").
export const PET_SPECIES: PetSpeciesInfo[] = [
  { id: "guepardo", label: "Guepardo", image: guepardoImg, tagline: "Explosão pura", description: "O mais rápido de todos, mas não aguenta correr o dia inteiro. É pra quem ama tiro curto, intervalado e bater recorde nos 5K: sai na frente, dá tudo e depois desaba feliz no sofá." },
  { id: "lebre", label: "Lebre", image: lebreImg, tagline: "Energia que não para", description: "Ágil, inquieta e sempre pronta pra mais uma. Combina com quem corre quase todo dia, muda o percurso sem avisar e às vezes sai rápido demais. Só cuidado com a soneca no meio da prova." },
  { id: "cavalo", label: "Cavalo", image: cavaloImg, tagline: "Força e constância", description: "Forte, resistente e confiável. É pra quem gosta de rodagem longa, ritmo firme e meia maratona no horizonte: não é o mais explosivo, mas aguenta quilômetro atrás de quilômetro sem reclamar." },
  { id: "falcao", label: "Falcão", image: falcaoImg, tagline: "Foco e estratégia", description: "Enxerga a prova lá de cima antes de largar. Combina com quem treina com planilha, controla pace e frequência cardíaca e escolhe o momento certo de atacar. Paciente na caçada, preciso no bote." },
  { id: "galgo", label: "Galgo", image: galgoImg, tagline: "Alma de matilha", description: "Corre melhor em grupo e nunca deixa ninguém pra trás. É pra quem ama treino com a turma, assessoria e corrida de rua com os amigos. Leal, resistente e sempre puxando o bando." },
  { id: "tartaruga", label: "Tartaruga", image: tartarugaImg, tagline: "Devagar e sempre", description: "Não é a mais rápida, mas já ganhou corrida. É pra quem está começando, voltando de lesão ou simplesmente corre no próprio ritmo: com paciência e constância, uma hora chega lá — e chega mais longe que muita gente apressada." },
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
  rarity?: PetAccessoryRarity;
  /**
   * Arte do acessório (PNG/WebP com fundo transparente, ~512px, item centralizado
   * e olhando pra direita, igual aos pets). Sem image, o app mostra o emoji.
   * Fundo: imagem quadrada que cobre o quadro todo atrás do pet.
   */
  image?: string;
}

export type PetBodySlot = Exclude<PetAccessorySlot, "fundo">;

export interface PetAnchor {
  /** Centro do acessório, em fração (0–1) do quadro quadrado do pet. */
  x: number;
  y: number;
  /** Largura do acessório em fração do quadro. */
  width: number;
  /** Rotação em graus. */
  rotate: number;
}

// Onde cada parte do corpo fica em cada ilustração (as imagens de
// src/assets/pets são quadradas e recortadas igual). Valores iniciais
// estimados a olho: ajuste aqui quando a arte real dos acessórios chegar.
export const PET_ANCHORS: Record<PetSpecies, Record<PetBodySlot, PetAnchor>> = {
  cavalo: {
    cabeca: { x: 0.47, y: 0.08, width: 0.3, rotate: 0 },
    pescoco: { x: 0.37, y: 0.4, width: 0.3, rotate: 0 },
    corpo: { x: 0.33, y: 0.53, width: 0.5, rotate: 0 },
    pes: { x: 0.42, y: 0.95, width: 0.6, rotate: 0 },
  },
  falcao: {
    cabeca: { x: 0.44, y: 0.1, width: 0.28, rotate: 0 },
    pescoco: { x: 0.4, y: 0.3, width: 0.3, rotate: 0 },
    corpo: { x: 0.39, y: 0.46, width: 0.45, rotate: 0 },
    pes: { x: 0.52, y: 0.94, width: 0.4, rotate: 0 },
  },
  guepardo: {
    cabeca: { x: 0.41, y: 0.06, width: 0.28, rotate: 0 },
    pescoco: { x: 0.38, y: 0.3, width: 0.3, rotate: 0 },
    corpo: { x: 0.41, y: 0.46, width: 0.45, rotate: 0 },
    pes: { x: 0.4, y: 0.93, width: 0.55, rotate: 0 },
  },
  lebre: {
    cabeca: { x: 0.49, y: 0.2, width: 0.26, rotate: 0 },
    pescoco: { x: 0.45, y: 0.5, width: 0.28, rotate: 0 },
    corpo: { x: 0.43, y: 0.61, width: 0.42, rotate: 0 },
    pes: { x: 0.42, y: 0.93, width: 0.5, rotate: 0 },
  },
  galgo: {
    cabeca: { x: 0.4, y: 0.08, width: 0.28, rotate: 0 },
    pescoco: { x: 0.39, y: 0.44, width: 0.3, rotate: 0 },
    corpo: { x: 0.39, y: 0.54, width: 0.42, rotate: 0 },
    pes: { x: 0.42, y: 0.95, width: 0.55, rotate: 0 },
  },
  tartaruga: {
    cabeca: { x: 0.8, y: 0.38, width: 0.22, rotate: 10 },
    pescoco: { x: 0.8, y: 0.48, width: 0.2, rotate: 0 },
    corpo: { x: 0.46, y: 0.3, width: 0.6, rotate: 0 },
    pes: { x: 0.5, y: 0.82, width: 0.7, rotate: 0 },
  },
};

export type PetAccessoryRarity = "comum" | "raro" | "epico" | "lendario";

export const RARITY_INFO: Record<PetAccessoryRarity, { label: string; className: string }> = {
  comum: { label: "Comum", className: "text-muted-foreground" },
  raro: { label: "Raro", className: "text-sky-400" },
  epico: { label: "Épico", className: "text-purple-400" },
  lendario: { label: "Lendário", className: "text-amber-400" },
};

export const ACCESSORY_SLOTS: { id: PetAccessorySlot; label: string }[] = [
  { id: "cabeca", label: "Cabeça" },
  { id: "pescoco", label: "Pescoço" },
  { id: "corpo", label: "Corpo" },
  { id: "pes", label: "Pés" },
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
  { id: "store-cartola", label: "Cartola clássica", slot: "cabeca", emoji: "🎩", source: "store", price: 80, rarity: "comum" },
  { id: "store-oculos", label: "Óculos escuros", slot: "cabeca", emoji: "🕶️", source: "store", price: 60, rarity: "comum" },
  { id: "store-cachecol", label: "Cachecol", slot: "pescoco", emoji: "🧣", source: "store", price: 50, rarity: "comum" },
  { id: "store-laco", label: "Laço", slot: "pescoco", emoji: "🎀", source: "store", price: 40, rarity: "comum" },
  { id: "store-skyline", label: "Skyline noturno", slot: "fundo", emoji: "🌆", source: "store", price: 100, rarity: "comum" },
  { id: "store-arcoiris", label: "Arco-íris", slot: "fundo", emoji: "🌈", source: "store", price: 70, rarity: "comum" },
  { id: "store-bandana", label: "Bandana de treino", slot: "cabeca", emoji: "🧕", source: "store", price: 40, rarity: "comum" },
  { id: "store-faixa", label: "Faixa de suor", slot: "cabeca", emoji: "🎗️", source: "store", price: 30, rarity: "comum" },
  { id: "store-gorro", label: "Gorro de inverno", slot: "cabeca", emoji: "🧶", source: "store", price: 60, rarity: "comum" },
  { id: "store-chapeu-sol", label: "Chapéu de sol", slot: "cabeca", emoji: "👒", source: "store", price: 70, rarity: "comum" },
  { id: "store-capacete", label: "Capacete de ciclista", slot: "cabeca", emoji: "⛑️", source: "store", price: 90, rarity: "comum" },
  { id: "store-fone", label: "Fone de corrida", slot: "cabeca", emoji: "🎧", source: "store", price: 120, rarity: "raro" },
  { id: "store-chapeu-cowboy", label: "Chapéu de cowboy", slot: "cabeca", emoji: "🤠", source: "store", price: 140, rarity: "raro" },
  { id: "store-tiara-flores", label: "Tiara de flores", slot: "cabeca", emoji: "🌸", source: "store", price: 150, rarity: "raro" },
  { id: "store-chapeu-festa", label: "Chapéu de festa", slot: "cabeca", emoji: "🥳", source: "store", price: 160, rarity: "raro" },
  { id: "store-chapeu-mago", label: "Chapéu de mago", slot: "cabeca", emoji: "🧙", source: "store", price: 280, rarity: "epico" },
  { id: "store-aureola", label: "Auréola", slot: "cabeca", emoji: "😇", source: "store", price: 320, rarity: "epico" },
  { id: "store-capacete-astronauta", label: "Capacete de astronauta", slot: "cabeca", emoji: "🧑‍🚀", source: "store", price: 350, rarity: "epico" },
  { id: "store-chifres-neon", label: "Chifres neon", slot: "cabeca", emoji: "😈", source: "store", price: 380, rarity: "epico" },
  { id: "store-coroa-diamante", label: "Coroa de diamante", slot: "cabeca", emoji: "💎", source: "store", price: 800, rarity: "lendario" },
  { id: "store-coroa-louros", label: "Coroa de louros olímpica", slot: "cabeca", emoji: "🌿", source: "store", price: 1000, rarity: "lendario" },
  { id: "store-apito", label: "Apito de treinador", slot: "pescoco", emoji: "📯", source: "store", price: 40, rarity: "comum" },
  { id: "store-gravata", label: "Gravata", slot: "pescoco", emoji: "👔", source: "store", price: 60, rarity: "comum" },
  { id: "store-numero-peito", label: "Número de peito", slot: "pescoco", emoji: "🔢", source: "store", price: 70, rarity: "comum" },
  { id: "store-colar-perolas", label: "Colar de pérolas", slot: "pescoco", emoji: "📿", source: "store", price: 90, rarity: "comum" },
  { id: "store-cronometro", label: "Cronômetro de pescoço", slot: "pescoco", emoji: "⏲️", source: "store", price: 120, rarity: "raro" },
  { id: "store-sino", label: "Sininho", slot: "pescoco", emoji: "🔔", source: "store", price: 130, rarity: "raro" },
  { id: "store-colar-trevo", label: "Colar de trevo", slot: "pescoco", emoji: "🍀", source: "store", price: 150, rarity: "raro" },
  { id: "store-medalha-bronze", label: "Medalha de bronze", slot: "pescoco", emoji: "🥉", source: "store", price: 180, rarity: "raro" },
  { id: "store-medalha-prata", label: "Medalha de prata", slot: "pescoco", emoji: "🥈", source: "store", price: 300, rarity: "epico" },
  { id: "store-colar-raio", label: "Colar relâmpago", slot: "pescoco", emoji: "⚡", source: "store", price: 340, rarity: "epico" },
  { id: "store-amuleto-lua", label: "Amuleto lunar", slot: "pescoco", emoji: "🌙", source: "store", price: 360, rarity: "epico" },
  { id: "store-medalha-ouro", label: "Medalha de ouro", slot: "pescoco", emoji: "🥇", source: "store", price: 700, rarity: "lendario" },
  { id: "store-capa-heroi", label: "Capa de herói", slot: "pescoco", emoji: "🦸", source: "store", price: 900, rarity: "lendario" },
  { id: "store-parque", label: "Parque da cidade", slot: "fundo", emoji: "🏞️", source: "store", price: 60, rarity: "comum" },
  { id: "store-praia", label: "Orla da praia", slot: "fundo", emoji: "🏖️", source: "store", price: 80, rarity: "comum" },
  { id: "store-pista", label: "Pista de atletismo", slot: "fundo", emoji: "🏟️", source: "store", price: 90, rarity: "comum" },
  { id: "store-chuva", label: "Treino na chuva", slot: "fundo", emoji: "🌧️", source: "store", price: 70, rarity: "comum" },
  { id: "store-trilha", label: "Trilha na floresta", slot: "fundo", emoji: "🌲", source: "store", price: 120, rarity: "raro" },
  { id: "store-deserto", label: "Deserto ao entardecer", slot: "fundo", emoji: "🏜️", source: "store", price: 140, rarity: "raro" },
  { id: "store-neve", label: "Corrida na neve", slot: "fundo", emoji: "❄️", source: "store", price: 160, rarity: "raro" },
  { id: "store-cerejeiras", label: "Cerejeiras em flor", slot: "fundo", emoji: "🌸", source: "store", price: 180, rarity: "raro" },
  { id: "store-vulcao", label: "Vulcão", slot: "fundo", emoji: "🌋", source: "store", price: 320, rarity: "epico" },
  { id: "store-aurora", label: "Aurora boreal", slot: "fundo", emoji: "🌌", source: "store", price: 380, rarity: "epico" },
  { id: "store-fogos", label: "Fogos de artifício", slot: "fundo", emoji: "🎆", source: "store", price: 400, rarity: "epico" },
  { id: "store-oceano", label: "Fundo do oceano", slot: "fundo", emoji: "🌊", source: "store", price: 350, rarity: "epico" },
  { id: "store-espaco", label: "Corrida no espaço", slot: "fundo", emoji: "🪐", source: "store", price: 900, rarity: "lendario" },
  { id: "store-podio", label: "Pódio olímpico", slot: "fundo", emoji: "🏆", source: "store", price: 1200, rarity: "lendario" },
  { id: "store-regata", label: "Regata de treino", slot: "corpo", emoji: "🎽", source: "store", price: 40, rarity: "comum" },
  { id: "store-camiseta-prova", label: "Camiseta de prova", slot: "corpo", emoji: "👕", source: "store", price: 50, rarity: "comum" },
  { id: "store-corta-vento", label: "Corta-vento", slot: "corpo", emoji: "🧥", source: "store", price: 80, rarity: "comum" },
  { id: "store-colete-refletivo", label: "Colete refletivo", slot: "corpo", emoji: "🦺", source: "store", price: 70, rarity: "comum" },
  { id: "store-pochete", label: "Pochete de hidratação", slot: "corpo", emoji: "👝", source: "store", price: 60, rarity: "comum" },
  { id: "store-mochila", label: "Mochila de trail", slot: "corpo", emoji: "🎒", source: "store", price: 90, rarity: "comum" },
  { id: "store-capa-chuva", label: "Capa de chuva", slot: "corpo", emoji: "☔", source: "store", price: 80, rarity: "comum" },
  { id: "store-moletom", label: "Moletom do clube", slot: "corpo", emoji: "🧶", source: "store", price: 120, rarity: "raro" },
  { id: "store-colete-hidratacao", label: "Colete de hidratação", slot: "corpo", emoji: "💧", source: "store", price: 140, rarity: "raro" },
  { id: "store-kimono", label: "Kimono", slot: "corpo", emoji: "🥋", source: "store", price: 160, rarity: "raro" },
  { id: "store-havaiana", label: "Camisa havaiana", slot: "corpo", emoji: "🌺", source: "store", price: 130, rarity: "raro" },
  { id: "store-uniforme-futebol", label: "Camisa do Brasil", slot: "corpo", emoji: "🇧🇷", source: "store", price: 180, rarity: "raro" },
  { id: "store-asas-anjo", label: "Asas de anjo", slot: "corpo", emoji: "🪽", source: "store", price: 320, rarity: "epico" },
  { id: "store-armadura", label: "Armadura medieval", slot: "corpo", emoji: "🛡️", source: "store", price: 380, rarity: "epico" },
  { id: "store-traje-espacial", label: "Traje espacial", slot: "corpo", emoji: "🚀", source: "store", price: 400, rarity: "epico" },
  { id: "store-jaqueta-neon", label: "Jaqueta neon", slot: "corpo", emoji: "💜", source: "store", price: 350, rarity: "epico" },
  { id: "store-smoking", label: "Smoking de gala", slot: "corpo", emoji: "🤵", source: "store", price: 300, rarity: "epico" },
  { id: "store-asas-fenix", label: "Asas de fênix", slot: "corpo", emoji: "🔥", source: "store", price: 950, rarity: "lendario" },
  { id: "store-armadura-ouro", label: "Armadura dourada", slot: "corpo", emoji: "✨", source: "store", price: 1100, rarity: "lendario" },
  { id: "store-tenis-basico", label: "Tênis básico", slot: "pes", emoji: "👟", source: "store", price: 50, rarity: "comum" },
  { id: "store-meias-listradas", label: "Meias listradas", slot: "pes", emoji: "🧦", source: "store", price: 30, rarity: "comum" },
  { id: "store-chinelo", label: "Chinelo de recuperação", slot: "pes", emoji: "🩴", source: "store", price: 40, rarity: "comum" },
  { id: "store-galochas", label: "Galochas", slot: "pes", emoji: "🥾", source: "store", price: 70, rarity: "comum" },
  { id: "store-caneleira", label: "Caneleira de compressão", slot: "pes", emoji: "🦵", source: "store", price: 90, rarity: "comum" },
  { id: "store-sapatilha-pista", label: "Sapatilha de pista", slot: "pes", emoji: "⚡", source: "store", price: 130, rarity: "raro" },
  { id: "store-tenis-trail", label: "Tênis de trail", slot: "pes", emoji: "⛰️", source: "store", price: 150, rarity: "raro" },
  { id: "store-patins", label: "Patins", slot: "pes", emoji: "🛼", source: "store", price: 170, rarity: "raro" },
  { id: "store-botas-neve", label: "Botas de neve", slot: "pes", emoji: "❄️", source: "store", price: 160, rarity: "raro" },
  { id: "store-tenis-carbono", label: "Tênis de placa de carbono", slot: "pes", emoji: "🏎️", source: "store", price: 380, rarity: "epico" },
  { id: "store-botas-foguete", label: "Botas-foguete", slot: "pes", emoji: "🚀", source: "store", price: 400, rarity: "epico" },
  { id: "store-tenis-led", label: "Tênis de LED", slot: "pes", emoji: "💡", source: "store", price: 340, rarity: "epico" },
  { id: "store-sandalias-aladas", label: "Sandálias aladas", slot: "pes", emoji: "🪶", source: "store", price: 900, rarity: "lendario" },
  { id: "store-tenis-ouro", label: "Tênis de ouro", slot: "pes", emoji: "🏅", source: "store", price: 1100, rarity: "lendario" },
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
