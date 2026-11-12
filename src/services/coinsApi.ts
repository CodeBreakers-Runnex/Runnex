import { api } from "@/services/apiClient";

export interface CoinPacksInfo {
  packs: { id: string; coins: number }[];
  /** true = backend aceita compra simulada (ambiente de teste). */
  mockPurchases: boolean;
}

export interface CoinPurchaseRecord {
  id: number;
  packId: string;
  coins: number;
  provider: string;
  status: "credited" | "refunded";
  createdAt: string;
}

export const getCoinPacks = () => api.get<CoinPacksInfo>("/coins/packs");

// Compra simulada (sem cobrança). Some quando entrar o Google Play.
export const mockPurchaseCoins = (userId: string, packId: string) =>
  api.post<{ petCoins: number; credited: number }>(`/users/${userId}/coins/mock-purchase`, { packId });

export const getCoinPurchases = (userId: string) => api.get<CoinPurchaseRecord[]>(`/users/${userId}/coins/purchases`);
