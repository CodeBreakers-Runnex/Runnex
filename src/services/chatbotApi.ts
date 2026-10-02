import { api } from "@/services/apiClient";

// Treinador virtual: o backend responde com base nas corridas e na meta
// semanal do próprio usuário (backend/app/routers/chatbot.py). O fuso vai
// junto porque "últimos 7 dias" segue o dia local, igual ao km da semana
// que a tela de Perfil mostra.
export const sendChatbotMessage = async (message: string): Promise<string> => {
  const { reply } = await api.post<{ reply: string }>("/chatbot/message", {
    message: message.trim(),
    utcOffsetMinutes: -new Date().getTimezoneOffset(),
  });
  return reply;
};
