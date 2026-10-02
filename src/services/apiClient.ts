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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
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
    throw new ApiError(response.status, getErrorDetail(body.detail) || "Erro na API do Veloxy.");
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export { ApiError };
