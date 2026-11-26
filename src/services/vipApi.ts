import { api } from "@/services/apiClient";

export interface VipInfo {
  /** true = o servidor aceita ativar o VIP de teste (demonstração). */
  mockActivation: boolean;
}

export const getVipInfo = () => api.get<VipInfo>("/vip");

// Plano VIP sem pagamento: só o modo de teste do servidor liga e desliga.
export const mockActivateVip = (userId: string) =>
  api.post<{ isVip: boolean }>(`/users/${userId}/vip/mock-activate`);

export const mockDeactivateVip = (userId: string) =>
  api.post<{ isVip: boolean }>(`/users/${userId}/vip/mock-deactivate`);
