// Camada de acesso a dados do app, dividida por dominio (mesmo recorte dos
// routers do backend: users.py, activities.py, groups.py, events.py,
// pet.py). Este arquivo existe so como ponto de entrada unico
// para nao exigir atualizar todo import existente pelo projeto — o codigo
// de verdade vive em cada *Api.ts.
export * from "@/services/usersApi";
export * from "@/services/activitiesApi";
export * from "@/services/groupsApi";
export * from "@/services/eventsApi";
export * from "@/services/petApi";

// Re-exportar types para quem já importava direto daqui
export type {
  UserProfile,
  ActivityData,
  FeedActivity,
  RunningEvent,
  UserStats,
  RunningGroup,
  GroupPost,
  GroupPostComment,
  GroupMessage,
} from "@/types";
