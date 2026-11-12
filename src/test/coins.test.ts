import { beforeEach, describe, expect, it, vi } from "vitest";
import { COIN_PACKS, getBonusPercent } from "@/lib/coins";

const { api } = vi.hoisted(() => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("@/services/apiClient", () => ({ api }));

import { mockPurchaseCoins } from "@/services/coinsApi";

describe("pacotes de RunCoins", () => {
  it("ids únicos e bônus crescente", () => {
    expect(new Set(COIN_PACKS.map((p) => p.id)).size).toBe(COIN_PACKS.length);
    const bonuses = COIN_PACKS.map(getBonusPercent);
    expect(bonuses).toEqual([...bonuses].sort((a, b) => a - b));
    expect(getBonusPercent(COIN_PACKS[3])).toBe(40);
  });
});

describe("coinsApi", () => {
  beforeEach(() => Object.values(api).forEach((fn) => fn.mockReset()));

  it("compra envia só o id do pacote (nunca a quantidade de moedas)", async () => {
    api.post.mockResolvedValue({ petCoins: 300, credited: 300 });
    await mockPurchaseCoins("ana", "rx_coins_300");
    expect(api.post).toHaveBeenCalledWith("/users/ana/coins/mock-purchase", { packId: "rx_coins_300" });
  });
});
