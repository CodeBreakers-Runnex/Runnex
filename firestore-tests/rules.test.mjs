import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc, getDocs, collection, arrayUnion } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "veloxy-rules-test",
  firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"), host: "127.0.0.1", port: 8080 },
});
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "users/bruno"), { displayName: "Bruno", privateProfile: true, totalXP: 10 });
  await setDoc(doc(db, "activities/a1"), { userId: "bruno", distance: 5, route: [{ lat: 1, lng: 2 }] });
  await setDoc(doc(db, "groups/g1/messages/m1"), { text: "oi" });
});
const ana = env.authenticatedContext("ana").firestore();
const anon = env.unauthenticatedContext().firestore();
const cases = [
  ["app: ler o proprio doc", () => getDoc(doc(ana, "users/ana")), true],
  ["app: foto do Google (setDoc merge)", () => setDoc(doc(ana, "users/ana"), { photoURL: "https://x/a.png", displayName: "Ana" }, { merge: true }), true],
  ["app: entrar em grupo demo", () => setDoc(doc(ana, "users/ana"), { joinedGroupIds: arrayUnion("sp-runners") }, { merge: true }), true],
  ["app: salvar evento demo", () => setDoc(doc(ana, "users/ana"), { enrolledEvents: arrayUnion("e1") }, { merge: true }), true],
  ["app: excluir conta (apaga o proprio doc)", () => deleteDoc(doc(ana, "users/ana")), true],
  ["ataque: ler perfil de outro", () => getDoc(doc(ana, "users/bruno")), false],
  ["ataque: listar todos os usuarios", () => getDocs(collection(ana, "users")), false],
  ["ataque: ler corridas antigas", () => getDocs(collection(ana, "activities")), false],
  ["ataque: criar corrida no Firestore", () => setDoc(doc(ana, "activities/x"), { userId: "ana", distance: 999 }), false],
  ["ataque: ler chat de grupo antigo", () => getDocs(collection(ana, "groups/g1/messages")), false],
  ["ataque: sem login, ler usuario", () => getDoc(doc(anon, "users/bruno")), false],
];
let fails = 0;
for (const [name, fn, shouldPass] of cases) {
  let ok;
  try { await fn(); ok = true; } catch { ok = false; }
  const good = ok === shouldPass;
  if (!good) fails++;
  console.log(`${good ? "OK  " : "FALHOU"} ${name}: ${ok ? "permitido" : "negado"}`);
}
await env.cleanup();
process.exit(fails ? 1 : 0);
