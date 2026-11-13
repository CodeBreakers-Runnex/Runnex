import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Reconexão do WebSocket do grupo. Antes: a cada 3 s, para sempre, mesmo
// quando o servidor recusava por token inválido (4401) ou por a pessoa não
// ser mais membro (4403).

const mocks = vi.hoisted(() => ({ getIdToken: vi.fn() }));
vi.mock("@/config/firebase", () => ({ auth: { currentUser: { getIdToken: () => mocks.getIdToken() } } }));

class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  constructor(public url: string) { FakeSocket.instances.push(this); }
  send() { /* nada */ }
  close() { /* nada */ }
}

const last = () => FakeSocket.instances[FakeSocket.instances.length - 1];

async function subscribe() {
  const { subscribeToGroupEvents } = await import("@/services/groupSocket");
  const unsubscribe = subscribeToGroupEvents("7", () => undefined);
  await vi.advanceTimersByTimeAsync(0);
  return unsubscribe;
}

describe("reconexão do WebSocket do grupo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    FakeSocket.instances = [];
    mocks.getIdToken.mockReset().mockResolvedValue("token");
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.stubEnv("VITE_API_URL", "https://api.exemplo.com");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("queda de rede: espera cada vez mais (3 s, 6 s, 12 s...) até 30 s", async () => {
    const unsubscribe = await subscribe();
    const waits = [3_000, 6_000, 12_000, 24_000, 30_000, 30_000];
    for (const wait of waits) {
      const before = FakeSocket.instances.length;
      last().onclose?.({ code: 1006 });
      await vi.advanceTimersByTimeAsync(wait - 1);
      expect(FakeSocket.instances.length).toBe(before);
      await vi.advanceTimersByTimeAsync(1);
      expect(FakeSocket.instances.length).toBe(before + 1);
    }
    unsubscribe();
  });

  it("depois que a conexão volta a receber mensagens, a espera volta para 3 s", async () => {
    const unsubscribe = await subscribe();
    last().onclose?.({ code: 1006 });
    await vi.advanceTimersByTimeAsync(3_000);
    last().onclose?.({ code: 1006 });
    await vi.advanceTimersByTimeAsync(6_000);
    last().onmessage?.({ data: JSON.stringify({ type: "ready" }) });
    const before = FakeSocket.instances.length;
    last().onclose?.({ code: 1006 });
    await vi.advanceTimersByTimeAsync(3_000);
    expect(FakeSocket.instances.length).toBe(before + 1);
    unsubscribe();
  });

  it.each([4401, 4403])("recusa do servidor (%i) para de reconectar", async (code) => {
    const unsubscribe = await subscribe();
    last().onclose?.({ code });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(FakeSocket.instances).toHaveLength(1);
    unsubscribe();
  });
});
