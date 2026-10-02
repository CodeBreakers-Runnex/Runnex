export type CoachMessage = {
  id: string;
  from: "user" | "coach";
  text: string;
  at: number;
};

const MAX_STORED_MESSAGES = 50;

// O histórico da conversa com o treinador fica só no aparelho, por usuário.
// O backend guarda apenas o que o treinador precisa lembrar entre mensagens
// (pace informado, objetivo, respostas ensinadas), não as mensagens em si.
const storageKey = (uid: string) => `veloxy-coach-${uid}`;

function isCoachMessage(value: unknown): value is CoachMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return (
    typeof message.id === "string" &&
    (message.from === "user" || message.from === "coach") &&
    typeof message.text === "string" &&
    typeof message.at === "number"
  );
}

export function createCoachMessage(from: CoachMessage["from"], text: string): CoachMessage {
  const at = Date.now();
  return { id: `${at}-${Math.random().toString(36).slice(2, 8)}`, from, text, at };
}

export function loadCoachHistory(uid: string): CoachMessage[] {
  try {
    const stored = localStorage.getItem(storageKey(uid));
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter(isCoachMessage) : [];
  } catch {
    return [];
  }
}

export function saveCoachHistory(uid: string, messages: CoachMessage[]): void {
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)));
  } catch {
    // localStorage indisponivel: a conversa vale so enquanto a tela estiver aberta
  }
}

export function clearCoachHistory(uid: string): void {
  try {
    localStorage.removeItem(storageKey(uid));
  } catch {
    // idem
  }
}
