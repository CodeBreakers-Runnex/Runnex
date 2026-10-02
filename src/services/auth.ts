import {
  browserLocalPersistence,
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  setPersistence,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import type { User } from "firebase/auth";
import { deleteDoc, doc } from "firebase/firestore";

import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";

import { auth, db } from "@/config/firebase";
import { syncGoogleProfilePhoto } from "@/lib/user-photo";
import { createUserProfile, deleteUserAccount } from "@/services/database";

async function getNativeGoogleCredential() {
  const result = await FirebaseAuthentication.signInWithGoogle({
    useCredentialManager: false,
  });

  const credentialData = result.credential;

  if (!credentialData?.idToken && !credentialData?.accessToken) {
    throw new Error(
      "Google nao retornou credenciais para o app.",
    );
  }

  return GoogleAuthProvider.credential(
    credentialData.idToken,
    credentialData.accessToken,
  );
}

function createGoogleProvider() {
  const provider = new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: "select_account",
  });

  return provider;
}

export async function loginComGooglePopup() {
  await setPersistence(auth, browserLocalPersistence);

  // APP ANDROID / CAPACITOR
  if (Capacitor.isNativePlatform()) {
    const webResult = await signInWithCredential(
      auth,
      await getNativeGoogleCredential(),
    );

    await syncGoogleProfilePhoto(webResult.user);
    await ensureUserProfile(webResult.user);

    return webResult.user;
  }

  // NAVEGADOR / WEB
  const result = await signInWithPopup(
    auth,
    createGoogleProvider(),
  );

  await syncGoogleProfilePhoto(result.user);
  await ensureUserProfile(result.user);

  return result.user;
}

// Login com Google nunca passava pelo cadastro (createUserProfile só era
// chamado em Register.tsx), então a primeira corrida de uma conta Google
// quebrava no backend (activities.user_id é FK de users.uid). Best-effort:
// nunca bloqueia o login se o backend estiver fora do ar.
async function ensureUserProfile(user: { uid: string; displayName: string | null; photoURL: string | null }) {
  try {
    await createUserProfile(user.uid, {
      displayName: user.displayName,
      photoURL: user.photoURL,
    });
  } catch (error) {
    console.warn("Nao foi possivel garantir o perfil apos login com Google:", error);
  }
}

export function usesPasswordLogin(user: User) {
  return user.providerData.some((provider) => provider.providerId === "password");
}

// deleteUser exige login recente (auth/requires-recent-login); reautenticar
// ANTES de apagar qualquer dado evita ficar com os dados do backend apagados
// e o login do Firebase ainda existindo.
async function reauthenticate(user: User, password?: string) {
  if (usesPasswordLogin(user)) {
    if (!user.email || !password) throw new Error("Digite sua senha para confirmar.");
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    return;
  }

  if (Capacitor.isNativePlatform()) {
    await reauthenticateWithCredential(user, await getNativeGoogleCredential());
    return;
  }

  await reauthenticateWithPopup(user, createGoogleProvider());
}

export async function deleteCurrentAccount(password?: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("Nenhum usuario logado.");

  await reauthenticate(user, password);
  await deleteUserAccount(user.uid);

  // Documento legado do Firestore (joinedGroupIds/enrolledEvents dos
  // grupos/eventos de demonstracao). Best-effort: os dados principais ja
  // foram apagados no backend.
  try {
    await deleteDoc(doc(db, "users", user.uid));
  } catch (error) {
    console.warn("Nao foi possivel apagar o documento legado do Firestore:", error);
  }

  try {
    await deleteUser(user);
  } catch (error) {
    console.error("Dados apagados, mas deleteUser falhou:", error);
    await signOut(auth);
    throw new Error(
      "Seus dados foram apagados, mas não foi possível remover o login. Entre novamente e repita a exclusão.",
    );
  }
}
