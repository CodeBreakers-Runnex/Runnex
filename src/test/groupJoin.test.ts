import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/firebase", () => ({ auth: { currentUser: null }, db: {} }));
import { ApiError } from "@/services/apiClient";
import { describeJoinError } from "@/lib/group-join";

describe("describeJoinError", () => {
  it("código errado e bloqueio têm textos próprios", () => {
    expect(describeJoinError(new ApiError(403, "x"))).toMatch(/Código inválido/);
    expect(describeJoinError(new ApiError(429, "x"))).toMatch(/Muitas tentativas/);
  });
  it("qualquer outro erro vira o aviso genérico", () => {
    expect(describeJoinError(new ApiError(500, "x"))).toBe("Não foi possível entrar no grupo.");
    expect(describeJoinError(new Error("offline"))).toBe("Não foi possível entrar no grupo.");
  });
});
