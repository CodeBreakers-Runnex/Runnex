import { auth } from "@/config/firebase";

const API_URL = import.meta.env.VITE_API_URL as string | undefined;

type GroupEvent = { type: string; postId?: string };
type Listener = (event: GroupEvent) => void;

type GroupConnection = {
  ws: WebSocket | null;
  listeners: Set<Listener>;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  closed: boolean;
  // Espera até a próxima tentativa: dobra a cada queda, volta ao mínimo
  // quando chega uma mensagem do servidor.
  retryDelayMs: number;
};

const MIN_RETRY_MS = 3_000;
const MAX_RETRY_MS = 30_000;
// Recusa definitiva do servidor (backend/app/routers/groups.py): token
// inválido ou não é membro. Tentar de novo não muda nada; o polling de
// segurança das telas continua trazendo os dados.
const REFUSAL_CODES = new Set([4401, 4403]);

const connections = new Map<string, GroupConnection>();

// Sem token na URL: URLs ficam em log de servidor e de proxy. O token vai na
// primeira mensagem, logo que a conexão abre (backend/app/routers/groups.py).
function wsUrl(groupId: string): string {
  const base = (API_URL || "").replace(/^http/, "ws");
  return `${base}/groups/${groupId}/ws`;
}

async function openSocket(groupId: string, conn: GroupConnection) {
  const token = await auth.currentUser?.getIdToken();
  if (!token || conn.closed) return;

  const ws = new WebSocket(wsUrl(groupId));
  conn.ws = ws;

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "auth", token }));
  };

  ws.onmessage = (event) => {
    // Chegou mensagem: a conexão está saudável (com o servidor atual, a
    // primeira é o "ready" logo após autenticar).
    conn.retryDelayMs = MIN_RETRY_MS;
    try {
      const data = JSON.parse(event.data) as GroupEvent;
      conn.listeners.forEach((listener) => listener(data));
    } catch {
      // ignora mensagem que nao e JSON valido
    }
  };

  ws.onclose = (event) => {
    if (conn.closed || REFUSAL_CODES.has(event.code)) return;
    // Rede caiu, backend reiniciou ou está acordando: tenta de novo,
    // esperando cada vez mais (3 s, 6 s, 12 s... até 30 s) para não
    // martelar o servidor nem gastar bateria.
    const delay = conn.retryDelayMs;
    conn.retryDelayMs = Math.min(delay * 2, MAX_RETRY_MS);
    conn.reconnectTimer = setTimeout(() => openSocket(groupId, conn), delay);
  };
}

/**
 * Substitui o polling de 15s do chat/feed/comentarios do grupo por push via
 * WebSocket. Uma unica conexao por grupo e compartilhada entre quem quiser
 * escutar (chat, feed de posts, comentarios de um post) — cada assinante
 * decide, a partir do `type` do evento, se precisa buscar algo de novo.
 */
export function subscribeToGroupEvents(groupId: string, onEvent: Listener): () => void {
  let conn = connections.get(groupId);
  if (!conn) {
    conn = { ws: null, listeners: new Set(), reconnectTimer: null, closed: false, retryDelayMs: MIN_RETRY_MS };
    connections.set(groupId, conn);
    openSocket(groupId, conn);
  }

  conn.listeners.add(onEvent);

  return () => {
    const current = connections.get(groupId);
    if (!current) return;
    current.listeners.delete(onEvent);
    if (current.listeners.size === 0) {
      current.closed = true;
      if (current.reconnectTimer) clearTimeout(current.reconnectTimer);
      current.ws?.close();
      connections.delete(groupId);
    }
  };
}
