import { updateProfile, type User } from "firebase/auth";

export function getGooglePhotoURL(user: User | null | undefined) {
  return user?.providerData.find((provider) => provider.providerId === "google.com")?.photoURL || null;
}

export function getBestUserPhotoURL(user: User | null | undefined) {
  const googlePhoto = getGooglePhotoURL(user);
  if (googlePhoto) return googlePhoto;
  return user?.photoURL || null;
}

export async function syncGoogleProfilePhoto(user: User | null | undefined) {
  const googlePhoto = getGooglePhotoURL(user);
  if (!user || !googlePhoto) return null;

  if (user.photoURL !== googlePhoto) {
    await updateProfile(user, { photoURL: googlePhoto });
  }

  // Não grava mais nome/foto no documento antigo do Firestore: ninguém lê
  // (perfil, feed e ranking usam o Postgres), e o login com Google espera
  // esta função - um Firestore lento ou bloqueado atrapalhava o login.
  return googlePhoto;
}
