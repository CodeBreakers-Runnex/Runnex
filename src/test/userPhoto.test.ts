import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";

// syncGoogleProfilePhoto gravava nome e foto no documento antigo do
// Firestore, que ninguém lê (perfil, feed e ranking usam o Postgres). O
// login com Google espera essa função: uma falha ou demora do Firestore
// atrapalhava o login por causa de um dado sem uso.

const mocks = vi.hoisted(() => ({ updateProfile: vi.fn(), setDoc: vi.fn() }));
vi.mock("@/config/firebase", () => ({ auth: {}, db: {} }));
vi.mock("firebase/auth", () => ({ updateProfile: (...a: unknown[]) => mocks.updateProfile(...a) }));
vi.mock("firebase/firestore", () => ({ doc: vi.fn(), setDoc: (...a: unknown[]) => mocks.setDoc(...a) }));

import { syncGoogleProfilePhoto } from "@/lib/user-photo";

const GOOGLE = "https://lh3.googleusercontent.com/a/ana";
const user = (photoURL: string | null) => ({
  uid: "ana", displayName: "Ana", photoURL, providerData: [{ providerId: "google.com", photoURL: GOOGLE, displayName: "Ana" }],
}) as unknown as User;

describe("syncGoogleProfilePhoto", () => {
  beforeEach(() => {
    mocks.updateProfile.mockReset().mockResolvedValue(undefined);
    mocks.setDoc.mockReset().mockResolvedValue(undefined);
  });

  it("leva a foto do Google para o Firebase Auth e devolve a foto", async () => {
    await expect(syncGoogleProfilePhoto(user(null))).resolves.toBe(GOOGLE);
    expect(mocks.updateProfile).toHaveBeenCalledWith(expect.anything(), { photoURL: GOOGLE });
  });

  it("não regrava no Auth quando a foto já é a do Google", async () => {
    await syncGoogleProfilePhoto(user(GOOGLE));
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("conta sem Google não faz nada", async () => {
    const semGoogle = { uid: "bia", photoURL: null, providerData: [{ providerId: "password" }] } as unknown as User;
    await expect(syncGoogleProfilePhoto(semGoogle)).resolves.toBeNull();
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("não grava mais no Firestore", async () => {
    await syncGoogleProfilePhoto(user(null));
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });

  it("um Firestore fora do ar não trava a função", async () => {
    mocks.setDoc.mockReturnValue(new Promise(() => undefined)); // nunca responde
    await expect(syncGoogleProfilePhoto(user(null))).resolves.toBe(GOOGLE);
  });
});
