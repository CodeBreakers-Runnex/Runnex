import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Sem tempo limite, uma requisição presa (rede ruim, servidor travado)
// deixava a tela em "carregando" para sempre. Agora ela desiste e lança um
// ApiError 408, que a fila offline já trata como "tentar depois".

vi.mock("@/config/firebase", () => ({ auth: { currentUser: null } }));

// fetch que nunca responde, mas respeita o AbortSignal como o de verdade.
function hangingFetch(_url: string, init?: RequestInit) {
  return new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  });
}

async function loadClient() {
  vi.stubEnv("VITE_API_URL", "https://api.test");
  vi.resetModules();
  return import("@/services/apiClient");
}

describe("tempo limite das chamadas à API", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(hangingFetch));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("leitura desiste em 30 s com erro 408", async () => {
    const { api, ApiError } = await loadClient();
    const result = api.get("/users/ana").catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(30_000);
    const error = await result;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 408 });
  });

  it("escrita tem mais prazo (60 s): salvar corrida com rota grande não é cortado cedo", async () => {
    const { api } = await loadClient();
    let settled = false;
    const result = api.post("/activities", { distance: 5 }).catch((e: unknown) => e).finally(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await result).toMatchObject({ status: 408 });
  });

  it("resposta normal dentro do prazo não é afetada", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })));
    const { api } = await loadClient();
    await expect(api.get("/health")).resolves.toEqual({ ok: true });
  });
});
