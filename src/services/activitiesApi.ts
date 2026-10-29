import { api, ApiError, OWN_DATA_CACHE_MS } from "@/services/apiClient";
import type { ActivityData, FeedActivity, UserStats } from "@/types";

// Fase 1: os 3 chamadores passam objetos já tipados vindos da API (não mais
// dados brutos de documento do Firestore), por isso o parâmetro aceita
// FeedActivity diretamente em vez de Record<string, unknown>.
// Exportado porque groupsApi.ts tambem normaliza atividades (feed de grupo).
export function normalizeActivity(docId: string, data: FeedActivity): FeedActivity {
  return {
    ...data,
    id: docId,
    createdAtMs: typeof data.createdAtMs === "number" ? data.createdAtMs : undefined,
  };
}

// Arredonda o total de segundos por km ANTES de separar minutos e segundos;
// arredondar só os segundos podia gerar 5'60".
export function formatPace(totalSeconds: number, totalKm: number) {
  if (totalKm <= 0 || totalSeconds <= 0) return "0'00\"";
  const secondsPerKm = Math.round(totalSeconds / totalKm);
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = secondsPerKm % 60;
  return `${minutes}'${seconds.toString().padStart(2, "0")}"`;
}

function formatTotalTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

// Salvar uma nova atividade (corrida)
// Fase 1 da migração: activities, XP/petCoins e weeklyKm dos grupos do
// usuário agora são tudo tratado dentro de POST /activities no backend
// próprio (ver backend/app/routers/activities.py) — não precisa mais de uma
// segunda chamada para atualizar os grupos depois de salvar a corrida.
export const saveActivity = async (data: ActivityData) => {
  return api.post<{ id: string; xpUpdateFailed: boolean }>("/activities", data);
};

export const deleteUserActivities = async (userId: string): Promise<number> => {
  const { deleted_count: deletedCount } = await api.delete<{ deleted_count: number }>(
    `/activities/user/${userId}/all`
  );
  return deletedCount;
};

export const deleteUserActivity = async (activityId: string, userId: string) => {
  try {
    await api.delete(`/activities/${activityId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw new Error("Corrida não encontrada para este usuário.");
    }
    throw error;
  }
  void userId; // mantido na assinatura por compatibilidade com os chamadores existentes
};

// Feed de atividades — Fase 1: sem onSnapshot ainda (real-time via WebSocket
// é a Fase 2 do plano de migração). Por enquanto, poll simples a cada 15s.
// Interface mantida igual (retorna uma função de "unsubscribe") para não
// exigir mudanças nos componentes que já consomem isso.
export const subscribeToFeed = (
  callback: (activities: FeedActivity[]) => void,
  limitCount = 10
) => {
  let cancelled = false;

  const fetchFeed = async () => {
    try {
      const activities = await api.get<FeedActivity[]>(`/activities/feed?limit=${limitCount}`);
      if (!cancelled) callback(activities);
    } catch (error) {
      console.error("Erro ao buscar feed:", error);
    }
  };

  fetchFeed();
  const intervalId = setInterval(fetchFeed, 15_000);

  return () => {
    cancelled = true;
    clearInterval(intervalId);
  };
};

// Buscar atividades mais antigas (paginação cursor-based pelo id numérico)
export const loadMoreActivities = async (
  lastId: FeedActivity["id"],
  limitCount = 10
): Promise<FeedActivity[]> => {
  try {
    return await api.get<FeedActivity[]>(`/activities/feed?limit=${limitCount}&before_id=${lastId}`);
  } catch (error) {
    console.error("Erro ao carregar mais atividades:", error);
    return [];
  }
};

// Curtir/Descurtir uma atividade
export const toggleLike = async (activityId: string, userId: string, isLiked: boolean) => {
  try {
    await api.post(`/activities/${activityId}/like`, { isLiked });
  } catch (error) {
    console.error("Erro ao dar like:", error);
    throw error;
  }
  void userId; // mantido na assinatura: quem curte é sempre o usuario autenticado no backend
};

// Resposta de GET /activities/stats/me: números brutos, o app só formata.
type UserStatsResponse = {
  totalKm: number;
  runsCount: number;
  totalSeconds: number;
  totalCalories: number;
  currentStreak: number;
  weeklyTotalKm: number;
  weeklyData: { day: string; km: number }[];
  hasHourLongRun: boolean;
  hasSub10kRun: boolean;
  dawnRunsCount: number;
  nightRunsCount: number;
  bestActivity: FeedActivity | null;
  lastActivity: FeedActivity | null;
};

// Estatísticas do usuário logado. O servidor soma o histórico inteiro
// (antes o app baixava todas as corridas com limit=100000). O fuso vai junto
// para a sequência, o gráfico da semana e as conquistas de horário.
export const getUserStats = async (userId: string): Promise<UserStats> => {
  void userId; // o backend sempre usa o usuário autenticado
  try {
    const utcOffsetMinutes = -new Date().getTimezoneOffset();
    const stats = await api.get<UserStatsResponse>(`/activities/stats/me?utc_offset_minutes=${utcOffsetMinutes}`, {
      cacheMs: OWN_DATA_CACHE_MS,
    });
    const normalize = (activity: FeedActivity | null) =>
      activity ? normalizeActivity(activity.id, activity) : null;

    return {
      totalKm: stats.totalKm.toFixed(1),
      runsCount: stats.runsCount,
      totalTime: formatTotalTime(stats.totalSeconds),
      totalCalories: Math.round(stats.totalCalories),
      averagePace: formatPace(stats.totalSeconds, stats.totalKm),
      currentStreak: stats.currentStreak,
      weeklyTotalKm: stats.weeklyTotalKm,
      bestActivity: normalize(stats.bestActivity),
      lastActivity: normalize(stats.lastActivity),
      weeklyData: stats.weeklyData,
      hasHourLongRun: stats.hasHourLongRun,
      hasSub10kRun: stats.hasSub10kRun,
      dawnRunsCount: stats.dawnRunsCount,
      nightRunsCount: stats.nightRunsCount,
    };
  } catch (error) {
    console.error("Erro ao buscar estatísticas:", error);
    return {
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
  }
};

export const getUserActivities = async (userId: string, limitCount = 10): Promise<FeedActivity[]> => {
  try {
    const activities = await api.get<FeedActivity[]>(`/activities/user/${userId}?limit=${limitCount}`);
    return activities.map((activity) => normalizeActivity(activity.id, activity));
  } catch (error) {
    console.error("Erro ao buscar corridas do usuario:", error);
    return [];
  }
};
