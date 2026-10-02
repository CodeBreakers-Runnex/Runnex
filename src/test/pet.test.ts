import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { getPetMood, PET_ACCESSORIES } from "@/lib/pet";

const { api } = vi.hoisted(() => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("@/services/apiClient", () => ({ api }));

import { choosePet, equipPetAccessory, purchasePetAccessory } from "@/services/petApi";

describe("catálogo do pet", () => {
  it("todo acessório de conquista aponta para uma conquista que existe", () => {
    const achievementIds = new Set(ACHIEVEMENTS.map((a) => a.id));
    const missing = PET_ACCESSORIES.filter((a) => a.source === "achievement" && !achievementIds.has(a.achievementId!));
    expect(missing).toEqual([]);
  });

  it("todo item da loja tem preço positivo e ids são únicos", () => {
    const store = PET_ACCESSORIES.filter((a) => a.source === "store");
    expect(store.every((a) => (a.price ?? 0) > 0)).toBe(true);
    expect(new Set(PET_ACCESSORIES.map((a) => a.id)).size).toBe(PET_ACCESSORIES.length);
  });

  it("humor acompanha a sequência de dias", () => {
    expect(getPetMood(0)).toBe("triste");
    expect(getPetMood(1)).toBe("cansado");
    expect(getPetMood(3)).toBe("feliz");
  });
});

describe("petApi", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
  });

  it("choosePet remove espaços do nome", async () => {
    await choosePet("ana", "guepardo", "  Flash ");
    expect(api.post).toHaveBeenCalledWith("/users/ana/pet/choose", { species: "guepardo", name: "Flash" });
  });

  it("compra não envia preço (o backend cobra pelo catálogo dele)", async () => {
    await purchasePetAccessory("ana", "store-laco");
    expect(api.post).toHaveBeenCalledWith("/users/ana/pet/purchase", { accessoryId: "store-laco" });
  });

  it("equip com null desequipa o slot", async () => {
    await equipPetAccessory("ana", "cabeca", null);
    expect(api.put).toHaveBeenCalledWith("/users/ana/pet/equip", { slot: "cabeca", accessoryId: null });
  });
});
