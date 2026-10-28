// Exportação dos dados do usuário (LGPD: acesso e portabilidade).
// O backend devolve tudo que está no Postgres; aqui entram os dados da conta
// (Firebase Auth) e o documento antigo do Firestore, e o arquivo é entregue:
// no navegador, baixado; no Android, salvo e aberto no menu de compartilhar.

import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "@/config/firebase";
import { api } from "@/services/apiClient";

export async function buildUserDataExport(): Promise<Record<string, unknown>> {
  const user = auth.currentUser;
  if (!user) throw new Error("Faça login para exportar seus dados.");

  const server = await api.get<Record<string, unknown>>("/users/me/export");

  let firestoreLegacy: Record<string, unknown> | null = null;
  try {
    const snapshot = await getDoc(doc(db, "users", user.uid));
    firestoreLegacy = snapshot.exists() ? snapshot.data() : null;
  } catch {
    firestoreLegacy = null; // documento antigo é opcional; o principal está no servidor
  }

  return {
    ...server,
    account: {
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
      displayName: user.displayName,
      photoURL: user.photoURL,
      signInProviders: user.providerData.map((provider) => provider.providerId),
      createdAt: user.metadata.creationTime ?? null,
      lastSignInAt: user.metadata.lastSignInTime ?? null,
    },
    firestoreLegacy: firestoreLegacy ? JSON.parse(JSON.stringify(firestoreLegacy)) : null,
  };
}

export function exportFileName(now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return `runnex-meus-dados-${day}.json`;
}

/** Entrega o arquivo. Retorna "shared" no Android e "downloaded" no navegador. */
export async function saveUserDataExport(data: unknown, fileName = exportFileName()): Promise<"shared" | "downloaded"> {
  const json = JSON.stringify(data, null, 2);

  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({
      path: fileName,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: "Meus dados do Runnex", files: [uri], dialogTitle: "Salvar ou enviar meus dados" });
    return "shared";
  }

  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
