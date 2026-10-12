import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/firebase", () => ({ auth: { currentUser: null } }));

import { formatPace } from "@/services/activitiesApi";

describe("formatPace", () => {
  it("retorna 0'00\" sem distância ou tempo", () => {
    expect(formatPace(0, 0)).toBe("0'00\"");
    expect(formatPace(300, 0)).toBe("0'00\"");
  });

  it("formata ritmo exato", () => {
    expect(formatPace(300, 1)).toBe("5'00\"");
  });

  it("nunca exibe 60 segundos (ex.: 5'59,7\" vira 6'00\")", () => {
    // 359,7 s/km: arredondar só os segundos dava 5'60".
    expect(formatPace(3597, 10)).toBe("6'00\"");
  });
});
