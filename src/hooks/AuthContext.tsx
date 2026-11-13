import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth } from "@/config/firebase";
import { AuthContext } from "@/hooks/auth-context";
import { syncGoogleProfilePhoto } from "@/lib/user-photo";
import { api, OWN_DATA_CACHE_MS } from "@/services/apiClient";
import { createUserProfile } from "@/services/database";
import type { UserProfile } from "@/types";

// Leva a foto do Firebase Auth (em conta Google, a foto do Google) para o
// perfil no backend, que é a foto que feed, ranking e grupos mostram. Não
// grava quando o perfil já tem uma foto escolhida no app: ela fica só no
// backend como base64 (o Firebase Auth não aceita data URL) e era trocada
// pela foto do Google toda vez que o app abria. Se não der para ler o perfil
// (ainda não existe, servidor fora), grava como antes.
async function syncPhotoToBackend(uid: string, photoURL: string) {
  try {
    const profile = await api.get<UserProfile>(`/users/${uid}`, { cacheMs: OWN_DATA_CACHE_MS });
    if (profile.photoURL === photoURL || profile.photoURL?.startsWith("data:")) return;
  } catch {
    // Sem perfil para comparar: segue e grava (o PUT também cria o perfil).
  }
  await createUserProfile(uid, { photoURL });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      if (firebaseUser) {
        // syncGoogleProfilePhoto muda auth.currentUser por dentro do SDK,
        // mas isso nao dispara um novo onAuthStateChanged — sem o setUser
        // aqui depois, a tela ficava com o objeto `user` congelado com a
        // foto vazia, mesmo com a foto do Google ja sincronizada.
        syncGoogleProfilePhoto(firebaseUser)
          .then(() => {
            setUser(auth.currentUser);
            // Feed/ranking/etc mostram a foto salva no Postgres, nao a do
            // Firebase Auth diretamente — sem isso, so a primeira foto do
            // Google (salva no login) chegava la, nunca uma foto trocada
            // depois nas sessoes seguintes.
            const current = auth.currentUser;
            if (current?.photoURL) {
              return syncPhotoToBackend(current.uid, current.photoURL);
            }
          })
          .catch((error) => {
            console.warn("Nao foi possivel sincronizar foto do Google:", error);
          });
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
