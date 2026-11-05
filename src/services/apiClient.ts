import { auth } from "@/config/firebase";

const API_URL = import.meta.env.VITE_API_URL as string | undefined;

if (!API_URL) {
  console.error("Variavel de ambiente VITE_API_URL nao definida. Verifique seu .env.local");
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Erro de validacao do Pydantic (422) chega como lista de objetos
// ({ msg: "Value error, ..." }), nao como string - sem isso a mensagem
// virava "[object Object]".
function getErrorDetail(detail: unknown): string | undefined {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (typeof item?.msg === "string" ? item.msg.replace(/^Value error, /, "") : ""))
      .filter(Boolean);
    return messages.join(" ") || undefined;
  }
  return undefined;
}

async function send<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await auth.currentUser?.getIdToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText }));
    throw new ApiError(response.status, getErrorDetail(body.detail) || "Erro na API do Runnex.");
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

// Várias telas pedem os mesmos dados ao abrir (perfil, todas as corridas,
// grupos e eventos do usuário), e a troca de tela repete tudo. Dois
// mecanismos evitam ir ao servidor à toa:
// - GETs iguais feitos ao mesmo tempo compartilham a mesma resposta;
// - quem passa `cacheMs` reaproveita a resposta por esse tempo. Só use em
//   leituras dos dados do próprio usuário: feed, chat e posts de grupo mudam
//   por ação de outras pessoas e precisam sempre ir ao servidor.
// Qualquer escrita (POST/PUT/PATCH/DELETE) descarta tudo que foi guardado,
// para a próxima leitura já trazer o resultado dela.
// Menor que o polling do feed (15 s) e curto o bastante para ninguém ver
// dado velho depois de uma ação de outra pessoa.
export const OWN_DATA_CACHE_MS = 10_000;

type CacheEntry = { expiresAt: number; data: unknown };
const inFlight = new Map<string, Promise<unknown>>();
const responseCache = new Map<string, CacheEntry>();

function cacheKey(path: string) {
  return `${auth.currentUser?.uid ?? "anon"} ${path}`;
}

function copy<T>(data: T): T {
  // Quem recebe pode alterar o objeto (ex.: getUserProfile); cada um ganha
  // a sua cópia para não mexer na resposta guardada.
  // As respostas são JSON, então a cópia via JSON é fiel e funciona em
  // WebViews antigos, que não têm structuredClone.
  return data === undefined ? data : JSON.parse(JSON.stringify(data)) as T;
}

export function clearApiCache() {
  inFlight.clear();
  responseCache.clear();
}

async function get<T>(path: string, { cacheMs = 0 }: { cacheMs?: number } = {}): Promise<T> {
  const key = cacheKey(path);
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return copy(cached.data as T);

  let pending = inFlight.get(key) as Promise<T> | undefined;
  if (!pending) {
    pending = send<T>(path);
    const current = pending;
    inFlight.set(key, current);
    current.then(
      (data) => {
        if (inFlight.get(key) !== current) return; // cache limpo no meio do caminho
        inFlight.delete(key);
        if (cacheMs > 0) responseCache.set(key, { expiresAt: Date.now() + cacheMs, data });
      },
      () => {
        if (inFlight.get(key) === current) inFlight.delete(key);
      },
    );
  }
  return copy(await pending);
}

function write<T>(path: string, method: string, body?: unknown): Promise<T> {
  clearApiCache();
  return send<T>(path, { method, body: body ? JSON.stringify(body) : undefined }).finally(clearApiCache);
}

export const api = {
  get,
  post: <T>(path: string, body?: unknown) => write<T>(path, "POST", body),
  put: <T>(path: string, body?: unknown) => write<T>(path, "PUT", body),
  patch: <T>(path: string, body?: unknown) => write<T>(path, "PATCH", body),
  delete: <T>(path: string) => write<T>(path, "DELETE"),
};

export { ApiError };
