import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

const requiredEnvVars = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
] as const;

for (const key of requiredEnvVars) {
  if (!import.meta.env[key]) {
    console.error(
      `Variavel de ambiente ${key} nao definida. Verifique seu .env.local`
    );
  }
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
  // Alguns bloqueadores de anuncios/privacidade (uBlock, Brave Shield etc.)
  // derrubam o canal de streaming padrao do Firestore (ERR_BLOCKED_BY_CLIENT
  // em requests "Write/channel"). Long polling automatico usa um formato de
  // request que passa despercebido por esses filtros.
  experimentalAutoDetectLongPolling: true,
});
// Fase 1.5: em vez de depender da tela "Personalizar URL de acao" do
// console do Firebase (que se mostrou instavel/bugada ao salvar), passamos
// a URL de destino direto nas chamadas de sendEmailVerification e
// sendPasswordResetEmail via handleCodeInApp — o link do email aponta
// direto para /auth/action com mode+oobCode na query, sem passar pela
// pagina padrao do Firebase.
export const actionCodeSettings = {
  url: `${window.location.origin}/auth/action`,
  handleCodeInApp: true,
};
