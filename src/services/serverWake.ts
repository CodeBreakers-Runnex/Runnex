// O backend roda no plano gratuito do Render, que desliga o servidor depois de
// 15 minutos sem acesso. A primeira chamada depois disso espera o servidor
// subir de novo (de 30 s a 1 min). Aqui o app chama /health logo ao abrir,
// para o servidor já ir acordando enquanto a pessoa faz login, e as telas
// protegidas esperam essa resposta em vez de quebrar sem aviso.

const API_URL = import.meta.env.VITE_API_URL as string | undefined;

export const WAKE_TOTAL_TIMEOUT_MS = 120_000;
const ATTEMPT_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 2_000;

let pending: Promise<boolean> | null = null;
let awake = false;

export function isServerAwake() {
  return awake;
}

async function pingOnce(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_URL}/health`, { signal: controller.signal, cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function pingUntilAwake(totalTimeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + totalTimeoutMs;
  while (Date.now() < deadline) {
    if (await pingOnce()) return true;
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await wait(Math.min(RETRY_DELAY_MS, remaining));
  }
  return false;
}

/**
 * Resolve `true` quando o backend responde e `false` se não responder dentro
 * do prazo. Chamadas simultâneas compartilham a mesma espera; depois de uma
 * falha, a próxima chamada tenta de novo.
 */
export function ensureServerAwake(totalTimeoutMs = WAKE_TOTAL_TIMEOUT_MS): Promise<boolean> {
  if (!API_URL) return Promise.resolve(false);
  if (awake) return Promise.resolve(true);
  if (!pending) {
    pending = pingUntilAwake(totalTimeoutMs).then((ok) => {
      awake = ok;
      pending = null;
      return ok;
    });
  }
  return pending;
}

/** Só para testes. */
export function resetServerWakeForTests() {
  pending = null;
  awake = false;
}
