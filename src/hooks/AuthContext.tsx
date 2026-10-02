import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth } from "@/config/firebase";
import { AuthContext } from "@/hooks/auth-context";
import { syncGoogleProfilePhoto } from "@/lib/user-photo";
import { createUserProfile } from "@/services/database";

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
              return createUserProfile(current.uid, { photoURL: current.photoURL });
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
