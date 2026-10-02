import { auth } from "@/config/firebase";

const API_URL = import.meta.env.VITE_API_URL as string | undefined;

type GroupEvent = { type: string; postId?: string };
type Listener = (event: GroupEvent) => void;

type GroupConnection = {
  ws: WebSocket | null;
  listeners: Set<Listener>;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  closed: boolean;
};

const connections = new Map<string, GroupConnection>();

function wsUrl(groupId: string, token: string): string {
  const base = (API_URL || "").replace(/^http/, "ws");
  return `${base}/groups/${groupId}/ws?token=${encodeURIComponent(token)}`;
}

async function openSocket(groupId: string, conn: GroupConnection) {
  const token = await auth.currentUser?.getIdToken();
  if (!token || conn.closed) return;

  const ws = new WebSocket(wsUrl(groupId, token));
  conn.ws = ws;

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as GroupEvent;
      conn.listeners.forEach((listener) => listener(data));
    } catch {
      // ignora mensagem que nao e JSON valido
    }
  };

  ws.onclose = () => {
    if (conn.closed) return;
    // Backoff simples: reconecta em 3s enquanto alguem ainda estiver
    // inscrito nesse grupo (rede caiu, backend reiniciou, etc.).
    conn.reconnectTimer = setTimeout(() => openSocket(groupId, conn), 3000);
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
    conn = { ws: null, listeners: new Set(), reconnectTimer: null, closed: false };
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
