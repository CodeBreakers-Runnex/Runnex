import { describe, it, expect } from "vitest";
import { calculateXP, getLevelFromXP, LEVELS } from "@/lib/gamification";

describe("calculateXP", () => {
  it("dá 100 XP por km em ritmo normal", () => {
    // 5km em 30min = 6'00"/km, mais lento que o corte de bônus (5'00"/km)
    expect(calculateXP(5, 30 * 60)).toBe(500);
  });

  it("aplica bônus de 20% quando o ritmo é mais rápido que 5'00\"/km", () => {
    // 5km em 20min = 4'00"/km
    expect(calculateXP(5, 20 * 60)).toBe(Math.round(5 * 100 * 1.2));
  });

  it("não aplica bônus exatamente em 5'00\"/km (limite é estritamente menor)", () => {
    // 5km em 25min = 5'00"/km exatos
    expect(calculateXP(5, 25 * 60)).toBe(500);
  });

  it("retorna 0 para distância 0, sem dividir por zero", () => {
    expect(calculateXP(0, 120)).toBe(0);
  });

  it("arredonda o resultado (sem bônus de ritmo)", () => {
    // 0.337km num ritmo lento (sem bônus): 33.7 XP arredonda para 34
    expect(calculateXP(0.337, 600)).toBe(34);
  });
});

describe("getLevelFromXP", () => {
  it("começa como Iniciante com 0 XP", () => {
    const info = getLevelFromXP(0);
    expect(info.currentLevel).toBe("Iniciante");
    expect(info.nextLevel).toBe("Corredor");
    expect(info.xpToNext).toBe(1000);
  });

  it("sobe de nível exatamente no limiar de XP", () => {
    const info = getLevelFromXP(1000);
    expect(info.currentLevel).toBe("Corredor");
  });

  it("fica um XP abaixo do próximo nível", () => {
    const info = getLevelFromXP(999);
    expect(info.currentLevel).toBe("Iniciante");
    expect(info.xpToNext).toBe(1);
  });

  it("calcula o progresso proporcional dentro do nível atual", () => {
    // Entre Corredor (1000) e Avançado (5000): metade do caminho = 3000
    const info = getLevelFromXP(3000);
    expect(info.currentLevel).toBe("Corredor");
    expect(info.progress).toBeCloseTo(50, 5);
  });

  it("marca progresso 100% e xpToNext 0 no nível máximo", () => {
    const maxLevel = LEVELS[LEVELS.length - 1];
    const info = getLevelFromXP(maxLevel.minXP + 100000);
    expect(info.currentLevel).toBe(maxLevel.name);
    expect(info.nextLevel).toBe("Nível Máximo");
    expect(info.progress).toBe(100);
    expect(info.xpToNext).toBe(0);
  });
});
