import { doc, arrayUnion, arrayRemove, setDoc } from "firebase/firestore";
import { db } from "@/config/firebase";
import { api, ApiError } from "@/services/apiClient";
import { subscribeToGroupEvents } from "@/services/groupSocket";
import { normalizeActivity } from "@/services/activitiesApi";
import type { RunningGroup, FeedActivity, UserProfile, GroupPost, GroupPostComment, GroupMessage } from "@/types";

const FALLBACK_GROUPS: RunningGroup[] = [
  {
    id: "sp-runners",
    name: "Sao Paulo Runners",
    city: "Sao Paulo, SP",
    description: "Treinos urbanos, provas de rua e encontros semanais.",
    tag: "Urbano",
    createdBy: "system",
    creatorName: "Runnex",
    memberIds: [],
    membersCount: 128,
    weeklyKm: 842,
  },
  {
    id: "5k-iniciantes",
    name: "5K Iniciantes",
    city: "Brasil",
    description: "Comunidade para quem quer criar constancia nos primeiros 5 km.",
    tag: "Comecando",
    createdBy: "system",
    creatorName: "Runnex",
    memberIds: [],
    membersCount: 94,
    weeklyKm: 318,
  },
  {
    id: "treino-noturno",
    name: "Treino Noturno",
    city: "Online",
    description: "Para quem prefere correr depois do expediente.",
    tag: "Noite",
    createdBy: "system",
    creatorName: "Runnex",
    memberIds: [],
    membersCount: 76,
    weeklyKm: 454,
  },
];

// Fase 1: grupos migraram para o backend próprio. Se a API não retornar
// nenhum grupo real ainda, mantém os grupos de demonstração (mesmo
// comportamento de quando o Firestore estava vazio).
// Em caso de erro, lança: antes caía nos grupos de demonstração, e com o
// servidor fora a pessoa via grupos inventados no lugar dos dela.
export const getGroups = async (): Promise<RunningGroup[]> => {
  const groups = await api.get<RunningGroup[]>("/groups");
  return groups.length > 0 ? groups : FALLBACK_GROUPS;
};

// Criar grupo: userId/userName não são mais enviados — o backend usa o
// usuário autenticado (token) como criador e busca o nome no perfil já
// migrado, evitando que o client possa se declarar como outra pessoa.
export const createGroup = async ({
  name,
  city,
  description,
  tag,
}: {
  name: string;
  city: string;
  description: string;
  tag: string;
  userId: string;
  userName: string;
}) => {
  const group = await api.post<RunningGroup>("/groups", { name, city, description, tag });
  return group.id;
};

// joinGroup/leaveGroup: grupos de demonstração continuam gravando
// joinedGroupIds no Firestore (não têm linha real no Postgres); grupos
// reais vão direto para /groups/{id}/join|leave, que já cuida de
// membro+contador numa única transação no backend.
export const joinGroup = async (groupId: string, userId: string) => {
  if (FALLBACK_GROUPS.some((group) => group.id === groupId)) {
    await setDoc(doc(db, "users", userId), { joinedGroupIds: arrayUnion(groupId) }, { merge: true });
    return true;
  }

  await api.post(`/groups/${groupId}/join`);
  return true;
};

export const leaveGroup = async (groupId: string, userId: string) => {
  if (FALLBACK_GROUPS.some((group) => group.id === groupId)) {
    await setDoc(doc(db, "users", userId), { joinedGroupIds: arrayRemove(groupId) }, { merge: true });
    return true;
  }

  await api.post(`/groups/${groupId}/leave`);
  return true;
};

// Fase 1: activities agora vive no backend próprio, não mais no Firestore —
// mesmo com grupos ainda não migrados, essa busca precisa ir na API nova.
export const getGroupActivities = async (group: RunningGroup, limitCount = 12): Promise<FeedActivity[]> => {
  const memberIds = group.memberIds.slice(0, 30);
  if (memberIds.length === 0) return [];

  try {
    const rawActivities = await api.get<FeedActivity[]>(
      `/activities/by-users?user_ids=${memberIds.join(",")}&limit=${limitCount}`
    );
    return rawActivities.map((activity) => normalizeActivity(activity.id, activity));
  } catch (error) {
    console.error("Erro ao buscar feed do grupo:", error);
    return [];
  }
};

// Fase 1: perfis agora vivem no backend próprio, não mais no Firestore —
// mesmo com grupos ainda não migrados, essa busca precisa ir na API nova.
export const getGroupLeaderboard = async (group: RunningGroup): Promise<UserProfile[]> => {
  const memberIds = group.memberIds.slice(0, 30);
  if (memberIds.length === 0) return [];

  try {
    const profiles = await api.get<UserProfile[]>(`/users/by-ids?ids=${memberIds.join(",")}`);
    return profiles.sort((a, b) => (b.totalXP || 0) - (a.totalXP || 0));
  } catch (error) {
    console.error("Erro ao buscar ranking do grupo:", error);
    return [];
  }
};

// Busca um único grupo pelo ID (usado pela tela dedicada /grupo/:id, que
// precisa carregar o grupo direto a partir da URL, sem depender de uma
// lista já carregada em memória).
export const getGroupById = async (groupId: string): Promise<RunningGroup | null> => {
  const fallback = FALLBACK_GROUPS.find((group) => group.id === groupId);
  if (fallback) return fallback;

  try {
    return await api.get<RunningGroup>(`/groups/${groupId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
};

// Grava a foto do grupo (data URL base64 gerada por resizeImageToDataUrl; o
// app não usa Firebase Storage). O backend restringe a troca a quem criou o
// grupo (mesma regra que existia em firestore.rules).
export const updateGroupPhoto = async (groupId: string, photoURL: string): Promise<void> => {
  await api.put(`/groups/${groupId}/photo`, { photoURL });
};

type GroupEvent = { type: string; postId?: string };

// Busca inicial + nova busca a cada evento relevante do WebSocket + polling
// longo de segurança (caso o socket caia e a reconexão demore). Comum ao
// feed, aos comentários e ao chat do grupo. Uma falha na busca chama
// onError, para a tela trocar o carregando por "tentar de novo"; a próxima
// busca que der certo chama callback normalmente.
function subscribeToGroupResource<T>(
  groupId: string,
  path: string,
  callback: (data: T) => void,
  shouldRefetch: (event: GroupEvent) => boolean,
  onError?: (error: unknown) => void,
) {
  let cancelled = false;
  const fetchData = async () => {
    try {
      const data = await api.get<T>(path);
      if (!cancelled) callback(data);
    } catch (error) {
      console.error(`Erro ao buscar ${path}:`, error);
      if (!cancelled) onError?.(error);
    }
  };
  fetchData();

  const unsubscribeWs = subscribeToGroupEvents(groupId, (event) => {
    if (shouldRefetch(event)) fetchData();
  });
  const intervalId = setInterval(fetchData, 60_000);

  return () => {
    cancelled = true;
    unsubscribeWs();
    clearInterval(intervalId);
  };
}

// Feed do grupo — o WebSocket (subscribeToGroupEvents) avisa quando há post
// novo ou curtida; só então busca de novo.
export const subscribeToGroupPosts = (
  groupId: string,
  callback: (posts: GroupPost[]) => void,
  limitCount = 30,
  onError?: (error: unknown) => void,
) =>
  subscribeToGroupResource<GroupPost[]>(
    groupId,
    `/groups/${groupId}/posts?limit=${limitCount}`,
    callback,
    (event) => event.type === "post_created" || event.type === "post_like",
    onError,
  );

// authorId/authorName/authorPhoto não são mais enviados — o backend usa o
// usuário autenticado e busca nome/foto atuais no perfil (evita que o
// client se declare como outro autor, o que o Firestore antigo permitia).
export const createGroupPost = async ({
  groupId,
  text,
  imageURL,
}: {
  groupId: string;
  authorId: string;
  authorName: string;
  authorPhoto: string | null;
  text: string;
  imageURL?: string | null;
}) => {
  const post = await api.post<GroupPost>(`/groups/${groupId}/posts`, { text, imageURL });
  return post.id;
};

export const toggleGroupPostLike = async (groupId: string, postId: string, userId: string, isLiked: boolean) => {
  await api.post(`/groups/${groupId}/posts/${postId}/like`, { isLiked });
  void userId; // mantido na assinatura: quem curte é sempre o usuario autenticado no backend
};

// Comentários de uma publicação — o evento do socket é por grupo, então
// filtra pelo postId.
export const subscribeToGroupPostComments = (
  groupId: string,
  postId: string,
  callback: (comments: GroupPostComment[]) => void,
  onError?: (error: unknown) => void,
) =>
  subscribeToGroupResource<GroupPostComment[]>(
    groupId,
    `/groups/${groupId}/posts/${postId}/comments`,
    callback,
    (event) => event.type === "comment_created" && event.postId === postId,
    onError,
  );

export const addGroupPostComment = async (
  groupId: string,
  postId: string,
  { text }: { authorId: string; authorName: string; authorPhoto: string | null; text: string }
) => {
  const comment = await api.post<GroupPostComment>(`/groups/${groupId}/posts/${postId}/comments`, { text });
  return comment.id;
};

// Chat do grupo.
export const subscribeToGroupMessages = (
  groupId: string,
  callback: (messages: GroupMessage[]) => void,
  limitCount = 100,
  onError?: (error: unknown) => void,
) =>
  subscribeToGroupResource<GroupMessage[]>(
    groupId,
    `/groups/${groupId}/messages?limit=${limitCount}`,
    callback,
    (event) => event.type === "message_created",
    onError,
  );

export const sendGroupMessage = async ({
  groupId,
  text,
}: {
  groupId: string;
  senderId: string;
  senderName: string;
  senderPhoto: string | null;
  text: string;
}) => {
  await api.post(`/groups/${groupId}/messages`, { text });
};
