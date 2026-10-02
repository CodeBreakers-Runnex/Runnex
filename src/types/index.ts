// ─── Veloxy — Types Centralizados ────────────────────────────────────────────
// Todas as interfaces ficam aqui para manter uma única fonte de verdade.
// Importar a partir daqui em vez de database.ts quando precisar apenas dos tipos.

import { Timestamp } from "firebase/firestore";
import { LucideIcon } from "lucide-react";

// ═══ USER ═══
export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string | null;
  totalXP: number;
  level: string;
  monthlyKm: number;
  monthlyKmMonth?: string;
  bio?: string;
  location?: string;
  privateProfile?: boolean;
  weeklyGoalKm?: number;
  onboarded?: boolean;
  enrolledEvents?: string[];
  joinedGroupIds?: string[];
  termsAcceptedAt?: Timestamp;
  termsVersion?: string;
  createdAt?: Timestamp;
  lastUpdated?: Timestamp;
  petSpecies?: PetSpecies;
  petName?: string;
  petCoins?: number;
  petUnlockedAccessoryIds?: string[];
  petEquippedCabeca?: string | null;
  petEquippedPescoco?: string | null;
  petEquippedFundo?: string | null;
}

// ═══ ACTIVITY (CORRIDA) ═══
export interface ActivityData {
  userId: string;
  userName: string;
  userAvatar: string | null;
  distance: number;
  time: string;
  durationSeconds: number;
  pace: string;
  calories?: number;
  type: string;
  likes?: string[];
  route?: RoutePoint[];
  xpGained?: number;
  timestamp?: Timestamp | Date | { seconds: number; nanoseconds?: number };
  createdAtMs?: number;
}

export interface RoutePoint {
  lat: number;
  lng: number;
}

/** Atividade com ID do Firestore (resultado de uma query) */
export interface FeedActivity extends ActivityData {
  id: string;
}

// ═══ EVENT (CORRIDA / EVENTO) ═══
export interface RunningEvent {
  id: string;
  title: string;
  date: string;
  location: string;
  city: string;
  state?: string;
  country?: string;
  lat?: number;
  lng?: number;
  participantsCount: number;
  participantsIds?: string[];
  category: string;
  distanceOptions?: string[];
  image: string;
  price: string;
  officialUrl?: string;
  source?: string;
  sourceUrl?: string;
  sourceType?: "official" | "partner" | "manual" | "aggregated" | "demo";
  verified?: boolean;
  status?: "open" | "sold_out" | "closed" | "unknown";
  lastSyncedAt?: Date | Timestamp;
  distanceKm?: number | null;
  timestamp: Date | Timestamp;
}

// â•â•â• GROUP (COMUNIDADE) â•â•â•
export interface RunningGroup {
  id: string;
  name: string;
  city: string;
  description: string;
  tag: string;
  photoURL?: string | null;
  createdBy: string;
  creatorName: string;
  memberIds: string[];
  membersCount: number;
  weeklyKm: number;
  weeklyKmWeek?: string;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

// ═══ GROUP POST (FEED DO GRUPO) ═══
export interface GroupPost {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto: string | null;
  text: string;
  imageURL?: string | null;
  likes: string[];
  commentsCount: number;
  createdAt?: Timestamp | Date;
}

export interface GroupPostComment {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto: string | null;
  text: string;
  createdAt?: Timestamp | Date;
}

// ═══ GROUP CHAT MESSAGE ═══
export interface GroupMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto: string | null;
  text: string;
  createdAt?: Timestamp | Date;
}

// ═══ STATS ═══
export interface UserStats {
  totalKm: string;
  runsCount: number;
  totalTime: string;
  totalCalories: number;
  averagePace: string;
  currentStreak: number;
  weeklyTotalKm: number;
  bestActivity: FeedActivity | null;
  lastActivity: FeedActivity | null;
  weeklyData: { day: string; km: number }[];
  hasHourLongRun: boolean;
  hasSub10kRun: boolean;
  dawnRunsCount: number;
  nightRunsCount: number;
}

// ═══ PET ═══
export type PetSpecies = "guepardo" | "lebre" | "cavalo" | "falcao" | "galgo";
export type PetAccessorySlot = "cabeca" | "pescoco" | "fundo";

// ═══ GAMIFICATION ═══
export interface LevelInfo {
  currentLevel: string;
  currentXP: number;
  nextLevelXP: number;
  progress: number;
}

// ═══ UI HELPERS ═══
export interface ActivityBadge {
  label: string;
  icon: React.ReactNode;
}

export interface TabIconProps {
  icon: LucideIcon;
  size: number;
}
