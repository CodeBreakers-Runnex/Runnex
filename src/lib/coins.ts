// Pacotes de RunCoins. O backend credita pelo catálogo DELE
// (backend/app/pet_catalog.py COIN_PACKS — tests/test_parity.py confere);
// o preço aqui é só vitrine até a integração com o Google Play, quando
// passa a vir da loja (preço local com impostos).
export interface CoinPack {
  id: string;
  coins: number;
  /** Moedas sem bônus, para mostrar o "+X%". */
  baseCoins: number;
  priceLabel: string;
  highlight?: "popular" | "melhor-valor";
}

export const COIN_PACKS: CoinPack[] = [
  { id: "rx_coins_300", coins: 300, baseCoins: 300, priceLabel: "R$ 4,90" },
  { id: "rx_coins_1000", coins: 1100, baseCoins: 1000, priceLabel: "R$ 14,90" },
  { id: "rx_coins_2500", coins: 3100, baseCoins: 2500, priceLabel: "R$ 29,90", highlight: "popular" },
  { id: "rx_coins_6000", coins: 8400, baseCoins: 6000, priceLabel: "R$ 59,90", highlight: "melhor-valor" },
];

export function getBonusPercent(pack: CoinPack): number {
  return Math.round(((pack.coins - pack.baseCoins) / pack.baseCoins) * 100);
}
