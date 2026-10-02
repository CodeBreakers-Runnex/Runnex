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
    creatorName: "Veloxy",
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
    creatorName: "Veloxy",
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
    creatorName: "Veloxy",
    memberIds: [],
    membersCount: 76,
    weeklyKm: 454,
  },
];

// Fase 1: grupos migraram para o backend próprio. Se a API não retornar
// nenhum grupo real ainda, mantém os grupos de demonstração (mesmo
// comportamento de quando o Firestore estava vazio).
export const getGroups = async (): Promise<RunningGroup[]> => {
  try {
    const groups = await api.get<RunningGroup[]>("/groups");
    return groups.length > 0 ? groups : FALLBACK_GROUPS;
  } catch (error) {
    console.error("Erro ao buscar grupos:", error);
    return FALLBACK_GROUPS;
  }
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

// Grava a foto do grupo já enviada ao Storage. Backend restringe a troca a
// quem criou o grupo (mesma regra que existia em firestore.rules).
export const updateGroupPhoto = async (groupId: string, photoURL: string): Promise<void> => {
  await api.put(`/groups/${groupId}/photo`, { photoURL });
};

// Feed do grupo — Fase 2: WebSocket (subscribeToGroupEvents) substitui o
// polling de 15s da Fase 1. O fetch inicial continua igual; a partir daí,
// so refaz a busca quando um evento relevante chega pelo socket. O
// setInterval longo fica so como rede de seguranca caso o WebSocket caia
// e a reconexao demore.
export const subscribeToGroupPosts = (
  groupId: string,
  callback: (posts: GroupPost[]) => void,
  limitCount = 30
) => {
  let cancelled = false;
  const fetchPosts = async () => {
    try {
      const posts = await api.get<GroupPost[]>(`/groups/${groupId}/posts?limit=${limitCount}`);
      if (!cancelled) callback(posts);
    } catch (error) {
      console.error("Erro ao buscar feed do grupo:", error);
    }
  };
  fetchPosts();

  const unsubscribeWs = subscribeToGroupEvents(groupId, (event) => {
    if (event.type === "post_created" || event.type === "post_like") fetchPosts();
  });
  const intervalId = setInterval(fetchPosts, 60_000);

  return () => {
    cancelled = true;
    unsubscribeWs();
    clearInterval(intervalId);
  };
};

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

// Comentários de uma publicação — mesmo esquema via WebSocket do feed do
// grupo, filtrando pelo postId (o evento do socket é por grupo, não por post).
export const subscribeToGroupPostComments = (
  groupId: string,
  postId: string,
  callback: (comments: GroupPostComment[]) => void
) => {
  let cancelled = false;
  const fetchComments = async () => {
    try {
      const comments = await api.get<GroupPostComment[]>(`/groups/${groupId}/posts/${postId}/comments`);
      if (!cancelled) callback(comments);
    } catch (error) {
      console.error("Erro ao buscar comentarios do post:", error);
    }
  };
  fetchComments();

  const unsubscribeWs = subscribeToGroupEvents(groupId, (event) => {
    if (event.type === "comment_created" && event.postId === postId) fetchComments();
  });
  const intervalId = setInterval(fetchComments, 60_000);

  return () => {
    cancelled = true;
    unsubscribeWs();
    clearInterval(intervalId);
  };
};

export const addGroupPostComment = async (
  groupId: string,
  postId: string,
  { text }: { authorId: string; authorName: string; authorPhoto: string | null; text: string }
) => {
  const comment = await api.post<GroupPostComment>(`/groups/${groupId}/posts/${postId}/comments`, { text });
  return comment.id;
};

// Chat do grupo — mesmo esquema via WebSocket.
export const subscribeToGroupMessages = (
  groupId: string,
  callback: (messages: GroupMessage[]) => void,
  limitCount = 100
) => {
  let cancelled = false;
  const fetchMessages = async () => {
    try {
      const messages = await api.get<GroupMessage[]>(`/groups/${groupId}/messages?limit=${limitCount}`);
      if (!cancelled) callback(messages);
    } catch (error) {
      console.error("Erro ao buscar mensagens do grupo:", error);
    }
  };
  fetchMessages();

  const unsubscribeWs = subscribeToGroupEvents(groupId, (event) => {
    if (event.type === "message_created") fetchMessages();
  });
  const intervalId = setInterval(fetchMessages, 60_000);

  return () => {
    cancelled = true;
    unsubscribeWs();
    clearInterval(intervalId);
  };
};

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
