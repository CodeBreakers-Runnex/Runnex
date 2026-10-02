import { updateProfile, type User } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/config/firebase";

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

  await setDoc(
    doc(db, "users", user.uid),
    {
      photoURL: googlePhoto,
      displayName: user.displayName || user.providerData[0]?.displayName || "Corredor",
    },
    { merge: true }
  );

  return googlePhoto;
}
