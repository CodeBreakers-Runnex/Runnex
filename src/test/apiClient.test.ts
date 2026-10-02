import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.hoisted(() => ({
  currentUser: { getIdToken: vi.fn().mockResolvedValue("token-123") } as { getIdToken: () => Promise<string> } | null,
}));
vi.mock("@/config/firebase", () => ({ auth: mockAuth }));

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function captureError(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e);
  if (!(error instanceof Error)) throw new Error("a chamada deveria ter falhado");
  return error as Error & { status: number };
}

async function loadClient() {
  vi.stubEnv("VITE_API_URL", "https://api.test");
  vi.resetModules();
  return import("@/services/apiClient");
}

describe("apiClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("envia o ID token do Firebase como Bearer", async () => {
    const { api } = await loadClient();
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    await expect(api.post("/activities", { a: 1 })).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/activities");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect(init.headers.Authorization).toBe("Bearer token-123");
  });

  it("não envia Authorization sem usuário logado", async () => {
    const { api } = await loadClient();
    const previous = mockAuth.currentUser;
    mockAuth.currentUser = null;
    fetchMock.mockResolvedValue(jsonResponse(200, []));

    await api.get("/events");
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty("Authorization");
    mockAuth.currentUser = previous;
  });

  it("204 resolve como undefined", async () => {
    const { api } = await loadClient();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api.delete("/users/ana")).resolves.toBeUndefined();
  });

  it("erro com detail em texto vira ApiError com status e mensagem", async () => {
    const { api, ApiError } = await loadClient();
    fetchMock.mockResolvedValue(jsonResponse(429, { detail: "Muitas acoes em pouco tempo." }));

    const error = await captureError(api.post("/groups"));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(429);
    expect(error.message).toBe("Muitas acoes em pouco tempo.");
  });

  it("422 do Pydantic (lista) vira mensagem legível, sem 'Value error,'", async () => {
    const { api } = await loadClient();
    fetchMock.mockResolvedValue(jsonResponse(422, {
      detail: [
        { loc: ["body"], msg: "Value error, Velocidade media de 40 km/h esta acima do limite." },
        { loc: ["body", "distance"], msg: "Input should be greater than 0" },
      ],
    }));

    const error = await captureError(api.post("/activities"));
    expect(error.message).toBe("Velocidade media de 40 km/h esta acima do limite. Input should be greater than 0");
  });

  it("corpo de erro que não é JSON usa mensagem padrão", async () => {
    const { api } = await loadClient();
    fetchMock.mockResolvedValue(new Response("<html>Bad Gateway</html>", { status: 502 }));

    const error = await captureError(api.get("/feed"));
    expect(error.status).toBe(502);
    expect(error.message).toBe("Erro na API do Veloxy.");
  });
});
