import { doc, getDoc } from "firebase/firestore";
import { db } from "@/config/firebase";
import { api, ApiError } from "@/services/apiClient";
import type { UserProfile } from "@/types";

// Buscar perfil do usuário — Fase 1: os campos principais (XP, nível, pet)
// agora vêm do backend próprio (Postgres). joinedGroupIds/enrolledEvents são
// a união de grupos/eventos reais (Postgres) com os de demonstração
// (Firestore, nunca tiveram linha real no Postgres).
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const profile = await api.get<UserProfile>(`/users/${userId}`);

    const [realGroupIds, realEventIds, legacyIds] = await Promise.all([
      api.get<string[]>(`/groups/joined/${userId}`).catch((groupsError) => {
        console.warn("Nao foi possivel buscar grupos reais do usuario:", groupsError);
        return [] as string[];
      }),
      api.get<string[]>(`/events/enrolled/${userId}`).catch((eventsError) => {
        console.warn("Nao foi possivel buscar eventos reais do usuario:", eventsError);
        return [] as string[];
      }),
      (async () => {
        try {
          const legacySnap = await getDoc(doc(db, "users", userId));
          if (!legacySnap.exists()) return { joinedGroupIds: [] as string[], enrolledEvents: [] as string[] };
          const legacy = legacySnap.data();
          return {
            joinedGroupIds: Array.isArray(legacy.joinedGroupIds) ? legacy.joinedGroupIds : [],
            enrolledEvents: Array.isArray(legacy.enrolledEvents) ? legacy.enrolledEvents : [],
          };
        } catch (legacyError) {
          console.warn("Nao foi possivel ler joinedGroupIds/enrolledEvents do Firestore:", legacyError);
          return { joinedGroupIds: [] as string[], enrolledEvents: [] as string[] };
        }
      })(),
    ]);

    profile.joinedGroupIds = [...new Set([...realGroupIds, ...legacyIds.joinedGroupIds])];
    profile.enrolledEvents = [...new Set([...realEventIds, ...legacyIds.enrolledEvents])];

    return profile;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    console.error("Erro ao buscar perfil:", error);
    return null;
  }
};

// Cria/atualiza o perfil do usuário logo após o cadastro. Nunca envia
// totalXP/level — o backend controla esses campos (POST /activities), evitando
// que um create malformado zere ou sobrescreva estatísticas existentes.
export const createUserProfile = async (
  userId: string,
  data: {
    displayName?: string | null;
    photoURL?: string | null;
    termsVersion?: string;
    bio?: string | null;
    location?: string | null;
    onboarded?: boolean;
    weeklyGoalKm?: number;
    privateProfile?: boolean;
  }
) => {
  await api.put(`/users/${userId}`, data);
};

// Apaga do backend tudo que pertence ao usuario (ver
// backend/app/services/account_deletion.py). O login do Firebase e apagado
// depois, por deleteCurrentAccount (services/auth.ts).
export const deleteUserAccount = async (userId: string) => {
  await api.delete(`/users/${userId}`);
};

// Buscar Ranking Global (Top 10 por XP) — Fase 1: backend próprio.
export const getGlobalRanking = async (limitCount = 10): Promise<UserProfile[]> => {
  try {
    return await api.get<UserProfile[]>(`/users/ranking/global?limit=${limitCount}`);
  } catch (error) {
    console.error("Erro ao buscar ranking:", error);
    return [];
  }
};
