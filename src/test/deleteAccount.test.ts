import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";

const mockAuth = vi.hoisted(() => ({ currentUser: null as User | null }));
const deleteUserAccountMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/config/firebase", () => ({ auth: mockAuth, db: {} }));

vi.mock("firebase/auth", () => ({
  browserLocalPersistence: {},
  deleteUser: vi.fn().mockResolvedValue(undefined),
  EmailAuthProvider: { credential: vi.fn(() => ({})) },
  GoogleAuthProvider: vi.fn(),
  reauthenticateWithCredential: vi.fn().mockResolvedValue(undefined),
  reauthenticateWithPopup: vi.fn().mockResolvedValue(undefined),
  setPersistence: vi.fn(),
  signInWithCredential: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  doc: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock("@capacitor-firebase/authentication", () => ({ FirebaseAuthentication: {} }));
vi.mock("@/lib/user-photo", () => ({ syncGoogleProfilePhoto: vi.fn() }));
vi.mock("@/services/database", () => ({
  createUserProfile: vi.fn(),
  deleteUserAccount: deleteUserAccountMock,
}));

import { deleteCurrentAccount } from "@/services/auth";
import { saveCoachHistory, createCoachMessage } from "@/lib/coachHistory";

describe("deleteCurrentAccount", () => {
  beforeEach(() => {
    localStorage.clear();
    deleteUserAccountMock.mockClear();
    mockAuth.currentUser = {
      uid: "ana",
      email: "ana@teste.com",
      providerData: [{ providerId: "password" }],
    } as unknown as User;
  });

  it("apaga o histórico local do treinador depois de apagar os dados no backend", async () => {
    saveCoachHistory("ana", [createCoachMessage("user", "Oi")]);
    saveCoachHistory("bruno", [createCoachMessage("user", "Oi")]);
    expect(localStorage.getItem("veloxy-coach-ana")).not.toBeNull();

    await deleteCurrentAccount("senha-certa");

    expect(deleteUserAccountMock).toHaveBeenCalledWith("ana");
    expect(localStorage.getItem("veloxy-coach-ana")).toBeNull();
    // Só a conta apagada: outra conta usada no mesmo aparelho continua.
    expect(localStorage.getItem("veloxy-coach-bruno")).not.toBeNull();
  });

  it("mantém o histórico se a exclusão no backend falhar", async () => {
    saveCoachHistory("ana", [createCoachMessage("user", "Oi")]);
    deleteUserAccountMock.mockRejectedValueOnce(new Error("offline"));

    await expect(deleteCurrentAccount("senha-certa")).rejects.toThrow("offline");
    expect(localStorage.getItem("veloxy-coach-ana")).not.toBeNull();
  });
});
