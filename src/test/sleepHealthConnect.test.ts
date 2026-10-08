import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { uid: "ana" },
  plugin: { getStatus: vi.fn(), requestSleepPermission: vi.fn(), openSettings: vi.fn(), readSleep: vi.fn(), acknowledge: vi.fn(), disconnect: vi.fn(), exportData: vi.fn() },
  importSleepBatch: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({ Capacitor: { getPlatform: () => "android", isPluginAvailable: () => true }, registerPlugin: () => mocks.plugin }));
vi.mock("@/config/firebase", () => ({ auth: { get currentUser() { return mocks.user; } } }));
vi.mock("@/services/recoveryApi", () => ({ importSleepBatch: mocks.importSleepBatch }));

import { syncSleep } from "@/services/sleepHealthConnect";

describe("sincronização segura do sono", () => {
  beforeEach(() => {
    mocks.user.uid = "ana";
    for (const fn of Object.values(mocks.plugin)) fn.mockReset().mockResolvedValue(undefined);
    mocks.plugin.readSleep.mockResolvedValue({ records: [], deletedIds: [], nextToken: "next", hasMore: false });
    mocks.importSleepBatch.mockReset().mockResolvedValue({ imported: 1 });
  });

  it("confirma cada lote no backend antes de avançar o token e percorre páginas", async () => {
    const order: string[] = [];
    mocks.plugin.readSleep.mockResolvedValueOnce({ records: [], deletedIds: [], nextToken: "one", hasMore: true });
    mocks.importSleepBatch.mockImplementation(async () => { order.push("backend"); return { imported: 1 }; });
    mocks.plugin.acknowledge.mockImplementation(async () => { order.push("ack"); });
    expect(await syncSleep("ana", "generation")).toBe(2);
    expect(order).toEqual(["backend", "ack", "backend", "ack"]);
    expect(mocks.plugin.readSleep).toHaveBeenCalledWith({ scopeId: "ana:generation" });
  });

  it("não avança o token quando a API falha", async () => {
    mocks.importSleepBatch.mockRejectedValue(new Error("Offline"));
    await expect(syncSleep("ana", "generation")).rejects.toThrow("Offline");
    expect(mocks.plugin.acknowledge).not.toHaveBeenCalled();
  });

  it("descarta lote se a conta mudar durante a leitura", async () => {
    mocks.plugin.readSleep.mockImplementation(async () => { mocks.user.uid = "bia"; return { records: [], deletedIds: [], nextToken: "next", hasMore: false }; });
    await expect(syncSleep("ana", "generation")).rejects.toThrow("A conta mudou");
    expect(mocks.importSleepBatch).not.toHaveBeenCalled();
    expect(mocks.plugin.acknowledge).not.toHaveBeenCalled();
  });

  it("compartilha a mesma operação para cliques simultâneos", async () => {
    const first = syncSleep("ana", "generation");
    const second = syncSleep("ana", "generation");
    expect(first).toBe(second);
    await first;
    expect(mocks.plugin.readSleep).toHaveBeenCalledOnce();
  });
});
