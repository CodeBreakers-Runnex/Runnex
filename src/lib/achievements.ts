import {
  Award,
  Clock,
  Crown,
  Dumbbell,
  Flame,
  Gauge,
  Medal,
  Mountain,
  Moon,
  Sunrise,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { UserProfile, UserStats } from "@/types";

export interface AchievementDef {
  id: string;
  name: string;
  icon: LucideIcon;
  unlocked: (stats: UserStats, profile?: UserProfile | null) => boolean;
  detail: (stats: UserStats, profile?: UserProfile | null) => string;
}

// Conquistas focadas em performance de corrida. Cada uma também libera um
// acessório do pet (ver PET_ACCESSORIES em lib/pet.ts), mas a conquista em
// si é sempre sobre o corredor, não sobre o pet.
export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "primeira-corrida",
    name: "Primeira corrida",
    icon: Medal,
    unlocked: (stats) => (stats.runsCount || 0) > 0,
    detail: (stats) => (stats.runsCount > 0 ? "Conquistado" : "Salve sua primeira corrida"),
  },
  {
    id: "5k-completo",
    name: "5K completo",
    icon: Award,
    unlocked: (stats) => (stats.bestActivity?.distance || 0) >= 5,
    detail: (stats) => {
      const best = stats.bestActivity?.distance || 0;
      return best >= 5 ? `${best.toFixed(1)} km melhor corrida` : `${best.toFixed(1)}/5 km`;
    },
  },
  {
    id: "25km-acumulados",
    name: "25 km acumulados",
    icon: Trophy,
    unlocked: (stats) => Number(stats.totalKm || 0) >= 25,
    detail: (stats) => {
      const total = Number(stats.totalKm || 0);
      return total >= 25 ? `${total.toFixed(1)} km totais` : `${total.toFixed(1)}/25 km`;
    },
  },
  {
    id: "sequencia-3-dias",
    name: "Sequência 3 dias",
    icon: Flame,
    unlocked: (stats) => (stats.currentStreak || 0) >= 3,
    detail: (stats) => {
      const streak = stats.currentStreak || 0;
      return streak >= 3 ? `${streak} dias ativos` : `${streak}/3 dias`;
    },
  },
  {
    id: "250km-acumulados",
    name: "250 km acumulados",
    icon: Mountain,
    unlocked: (stats) => Number(stats.totalKm || 0) >= 250,
    detail: (stats) => {
      const total = Number(stats.totalKm || 0);
      return total >= 250 ? `${total.toFixed(0)} km totais` : `${total.toFixed(0)}/250 km`;
    },
  },
  {
    id: "uma-hora-corrida",
    name: "1 hora de corrida",
    icon: Clock,
    unlocked: (stats) => Boolean(stats.hasHourLongRun),
    detail: (stats) => (stats.hasHourLongRun ? "Conquistado" : "Corra 1h sem parar"),
  },
  {
    id: "sub-10k",
    name: "Sub 10K",
    icon: Gauge,
    unlocked: (stats) => Boolean(stats.hasSub10kRun),
    detail: (stats) => (stats.hasSub10kRun ? "Conquistado" : "Complete 10km abaixo de 1h"),
  },
  {
    id: "100-treinos",
    name: "100 treinos",
    icon: Dumbbell,
    unlocked: (stats) => (stats.runsCount || 0) >= 100,
    detail: (stats) => {
      const runs = stats.runsCount || 0;
      return runs >= 100 ? `${runs} corridas` : `${runs}/100 corridas`;
    },
  },
  {
    id: "meta-semanal-batida",
    name: "Meta batida",
    icon: Target,
    unlocked: (stats, profile) => Boolean(profile?.weeklyGoalKm) && stats.weeklyTotalKm >= (profile?.weeklyGoalKm || 0),
    detail: (stats, profile) => {
      const goal = profile?.weeklyGoalKm || 0;
      if (!goal) return "Defina uma meta semanal";
      return stats.weeklyTotalKm >= goal ? "Meta da semana batida" : `${stats.weeklyTotalKm.toFixed(1)}/${goal.toFixed(1)} km`;
    },
  },
  {
    id: "dez-amanheceres",
    name: "10 amanheceres",
    icon: Sunrise,
    unlocked: (stats) => (stats.dawnRunsCount || 0) >= 10,
    detail: (stats) => {
      const count = stats.dawnRunsCount || 0;
      return count >= 10 ? `${count} corridas ao amanhecer` : `${count}/10 amanheceres`;
    },
  },
  {
    id: "dez-noites",
    name: "10 noites",
    icon: Moon,
    unlocked: (stats) => (stats.nightRunsCount || 0) >= 10,
    detail: (stats) => {
      const count = stats.nightRunsCount || 0;
      return count >= 10 ? `${count} corridas noturnas` : `${count}/10 noites`;
    },
  },
  {
    id: "um-ano-ativo",
    name: "1 ano ativo",
    icon: Crown,
    unlocked: (stats) => (stats.currentStreak || 0) >= 365,
    detail: (stats) => {
      const streak = stats.currentStreak || 0;
      return streak >= 365 ? "1 ano de sequência!" : `${streak}/365 dias`;
    },
  },
];

export function getUnlockedAchievementIds(stats: UserStats | null, profile?: UserProfile | null): string[] {
  if (!stats) return [];
  return ACHIEVEMENTS.filter((achievement) => achievement.unlocked(stats, profile)).map((achievement) => achievement.id);
}
