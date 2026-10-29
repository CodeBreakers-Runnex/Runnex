import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  native: false,
  get: vi.fn(),
  getDoc: vi.fn(),
  writeFile: vi.fn(),
  share: vi.fn(),
  user: {
    uid: "ana", email: "ana@runnex.test", emailVerified: true, displayName: "Ana", photoURL: null,
    providerData: [{ providerId: "password" }], metadata: { creationTime: "Mon, 01 Sep 2026 10:00:00 GMT", lastSignInTime: undefined },
  } as Record<string, unknown> | null,
}));

vi.mock("@/config/firebase", () => ({ auth: { get currentUser() { return mocks.user; } }, db: {} }));
vi.mock("@/services/apiClient", () => ({ api: { get: mocks.get } }));
vi.mock("firebase/firestore", () => ({ doc: (...path: unknown[]) => path, getDoc: mocks.getDoc }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => mocks.native } }));
vi.mock("@capacitor/filesystem", () => ({
  Directory: { Cache: "CACHE" }, Encoding: { UTF8: "utf8" }, Filesystem: { writeFile: mocks.writeFile },
}));
vi.mock("@capacitor/share", () => ({ Share: { share: mocks.share } }));

import { buildUserDataExport, exportFileName, saveUserDataExport } from "@/services/dataExport";

describe("exportação dos dados (LGPD)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.native = false;
    mocks.get.mockResolvedValue({ exportVersion: 1, uid: "ana", tables: { activities: [{ id: 1 }] }, likes: {} });
    mocks.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ joinedGroupIds: ["demo-1"] }) });
  });

  it("junta servidor, conta e documento antigo do Firestore", async () => {
    const data = await buildUserDataExport();
    expect(mocks.get).toHaveBeenCalledWith("/users/me/export");
    expect(data.tables).toEqual({ activities: [{ id: 1 }] });
    expect(data.account).toMatchObject({ uid: "ana", email: "ana@runnex.test", signInProviders: ["password"], lastSignInAt: null });
    expect(data.firestoreLegacy).toEqual({ joinedGroupIds: ["demo-1"] });
  });

  it("segue sem o Firestore se ele falhar", async () => {
    mocks.getDoc.mockRejectedValue(new Error("offline"));
    expect((await buildUserDataExport()).firestoreLegacy).toBeNull();
  });

  it("exige login", async () => {
    mocks.user = null;
    await expect(buildUserDataExport()).rejects.toThrow("login");
    mocks.user = { uid: "ana", providerData: [], metadata: {} };
  });

  it("no Android salva no cache e abre o compartilhar", async () => {
    mocks.native = true;
    mocks.writeFile.mockResolvedValue({ uri: "file:///cache/runnex.json" });
    const result = await saveUserDataExport({ uid: "ana" }, "runnex.json");
    expect(result).toBe("shared");
    expect(mocks.writeFile).toHaveBeenCalledWith(expect.objectContaining({ path: "runnex.json", directory: "CACHE", data: expect.stringContaining('"uid": "ana"') }));
    expect(mocks.share).toHaveBeenCalledWith(expect.objectContaining({ files: ["file:///cache/runnex.json"] }));
  });

  it("no navegador baixa o arquivo", async () => {
    const createUrl = vi.fn(() => "blob:runnex");
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    expect(await saveUserDataExport({ uid: "ana" }, "runnex.json")).toBe("downloaded");
    expect(createUrl).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it("nomeia o arquivo com a data", () => {
    expect(exportFileName(new Date("2026-10-28T15:00:00Z"))).toBe("runnex-meus-dados-2026-10-28.json");
  });
});
