import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

async function loadModule() {
  vi.stubEnv("VITE_API_URL", "https://api.test");
  vi.resetModules();
  return import("@/services/serverWake");
}

describe("serverWake", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("resolve true quando /health responde", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    const { ensureServerAwake, isServerAwake } = await loadModule();

    await expect(ensureServerAwake()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("https://api.test/health", expect.anything());
    expect(isServerAwake()).toBe(true);
  });

  it("tenta de novo enquanto o servidor acorda", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response("", { status: 502 }))
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const { ensureServerAwake } = await loadModule();

    const result = ensureServerAwake();
    await vi.runAllTimersAsync();

    await expect(result).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("chamadas simultâneas compartilham a mesma espera", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    const { ensureServerAwake } = await loadModule();

    await Promise.all([ensureServerAwake(), ensureServerAwake()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("desiste depois do prazo e permite tentar de novo", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const { ensureServerAwake } = await loadModule();

    const first = ensureServerAwake(5_000);
    await vi.runAllTimersAsync();
    await expect(first).resolves.toBe(false);

    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    await expect(ensureServerAwake(5_000)).resolves.toBe(true);
  });
});
