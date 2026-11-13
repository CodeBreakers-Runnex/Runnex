import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// O token do Firebase não vai mais na URL do WebSocket (URLs ficam em log
// de servidor e proxy): a conexão abre sem ele e o app manda o token como
// primeira mensagem.

const mocks = vi.hoisted(() => ({ getIdToken: vi.fn() }));
vi.mock("@/config/firebase", () => ({ auth: { currentUser: { getIdToken: () => mocks.getIdToken() } } }));

class FakeSocket {
  static instances: FakeSocket[] = [];
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  constructor(public url: string) { FakeSocket.instances.push(this); }
  send(data: string) { this.sent.push(data); }
  close() { /* fechado pelo app */ }
}

describe("WebSocket do grupo", () => {
  beforeEach(() => {
    vi.resetModules();
    FakeSocket.instances = [];
    mocks.getIdToken.mockReset().mockResolvedValue("token-secreto");
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.stubEnv("VITE_API_URL", "https://api.exemplo.com");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("abre sem token na URL e manda o token na primeira mensagem", async () => {
    const { subscribeToGroupEvents } = await import("@/services/groupSocket");
    const unsubscribe = subscribeToGroupEvents("7", () => undefined);
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1));

    const socket = FakeSocket.instances[0];
    expect(socket.url).toBe("wss://api.exemplo.com/groups/7/ws");
    expect(socket.url).not.toContain("token");

    socket.onopen?.();
    expect(socket.sent.map((data) => JSON.parse(data))).toEqual([{ type: "auth", token: "token-secreto" }]);
    unsubscribe();
  });

  it("repassa os eventos do grupo para quem assinou", async () => {
    const { subscribeToGroupEvents } = await import("@/services/groupSocket");
    const listener = vi.fn();
    const unsubscribe = subscribeToGroupEvents("7", listener);
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
    FakeSocket.instances[0].onmessage?.({ data: JSON.stringify({ type: "message_created" }) });
    expect(listener).toHaveBeenCalledWith({ type: "message_created" });
    unsubscribe();
  });
});
