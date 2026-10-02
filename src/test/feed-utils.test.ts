import { describe, it, expect } from "vitest";
import { Timestamp } from "firebase/firestore";
import { toDateSafe, getActivityBadge, initials } from "@/lib/feed-utils";

describe("toDateSafe", () => {
  it("retorna null para valores ausentes", () => {
    expect(toDateSafe(null)).toBeNull();
    expect(toDateSafe(undefined)).toBeNull();
  });

  it("aceita um Date diretamente", () => {
    const date = new Date("2026-01-01T00:00:00Z");
    expect(toDateSafe(date)).toBe(date);
  });

  it("converte um Firestore Timestamp real", () => {
    const timestamp = Timestamp.fromDate(new Date("2026-02-01T12:00:00Z"));
    const result = toDateSafe(timestamp);
    expect(result?.toISOString()).toBe("2026-02-01T12:00:00.000Z");
  });

  it("converte um objeto { seconds } vindo de dados serializados", () => {
    const result = toDateSafe({ seconds: 1_700_000_000 });
    expect(result?.getTime()).toBe(1_700_000_000 * 1000);
  });
});

describe("getActivityBadge", () => {
  it("classifica corridas curtas como 'Em Forma'", () => {
    expect(getActivityBadge(2).label).toBe("Em Forma");
  });

  it("classifica a partir de 5km", () => {
    expect(getActivityBadge(5).label).toBe("5K Atingido");
  });

  it("classifica a partir de 10km", () => {
    expect(getActivityBadge(10).label).toBe("10K+ KM!");
  });

  it("classifica a partir de 21km como meia maratona", () => {
    expect(getActivityBadge(21.1).label).toBe("MEIA MARATONA!");
  });
});

describe("initials", () => {
  it("pega a primeira letra de até dois nomes", () => {
    expect(initials("Ana Costa")).toBe("AC");
  });

  it("lida com nome único", () => {
    expect(initials("Ana")).toBe("A");
  });

  it("retorna '??' para nome vazio", () => {
    expect(initials("")).toBe("??");
  });
});
