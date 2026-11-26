import { ApiError } from "@/services/apiClient";

// Texto para quem errou o código do grupo privado ou foi bloqueado por
// tentativas demais.
export const describeJoinError = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (error.status === 403) return "Código inválido. Confira com quem criou o grupo.";
    if (error.status === 429) return "Muitas tentativas com código errado. Tente de novo em alguns minutos.";
  }
  return "Não foi possível entrar no grupo.";
};
