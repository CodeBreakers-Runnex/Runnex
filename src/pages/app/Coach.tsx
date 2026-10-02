import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bot, Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/services/apiClient";
import { sendChatbotMessage } from "@/services/chatbotApi";
import {
  clearCoachHistory,
  createCoachMessage,
  loadCoachHistory,
  saveCoachHistory,
  type CoachMessage,
} from "@/lib/coachHistory";
import { GLASS_CARD_CLASS } from "@/components/GlassCard";
import { cn } from "@/lib/utils";

// Atalhos para o que o treinador responde com os dados do próprio app.
const SUGGESTIONS = [
  "Minhas estatísticas",
  "Meus recordes",
  "Qual minha meta?",
  "Quais minhas zonas de treino?",
  "Quanto tempo eu faria 10km?",
  "Como melhorar meu pace?",
];

function CoachAvatar() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-500/15 text-purple-500">
      <Bot size={15} />
    </div>
  );
}

function Bubble({ from, children }: { from: CoachMessage["from"]; children: ReactNode }) {
  const isOwn = from === "user";
  return (
    <div className={`flex items-end gap-2 ${isOwn ? "flex-row-reverse" : ""}`}>
      {!isOwn && <CoachAvatar />}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isOwn ? "bg-purple-600 text-white rounded-br-sm" : "bg-secondary/80 border border-input rounded-bl-sm"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export default function Coach() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.uid;
  const firstName = (user?.displayName || "Corredor").split(" ")[0] || "Corredor";

  const [messages, setMessages] = useState<CoachMessage[]>(() => (uid ? loadCoachHistory(uid) : []));
  const [historyOwner, setHistoryOwner] = useState(uid);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Troca de conta sem desmontar a tela: carrega o histórico do novo usuário.
  if (uid !== historyOwner) {
    setHistoryOwner(uid);
    setMessages(uid ? loadCoachHistory(uid) : []);
  }

  useEffect(() => {
    if (uid) saveCoachHistory(uid, messages);
  }, [uid, messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending]);

  const send = async (raw: string) => {
    const message = raw.trim();
    if (!uid || !message || sending) return;

    const userMessage = createCoachMessage("user", message);
    setMessages((prev) => [...prev, userMessage]);
    setText("");
    setSending(true);
    try {
      const reply = await sendChatbotMessage(message);
      setMessages((prev) => [...prev, createCoachMessage("coach", reply)]);
    } catch (error) {
      console.error("Erro no treinador virtual:", error);
      toast.error(
        error instanceof ApiError && error.status === 429
          ? error.message
          : "Não foi possível falar com o treinador agora.",
      );
      // Devolve o texto para o campo em vez de perder o que foi digitado.
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      setText(message);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    send(text);
  };

  const handleClear = () => {
    if (uid) clearCoachHistory(uid);
    setMessages([]);
  };

  return (
    <div className="app-shell flex h-[100svh] flex-col pb-28 safe-top lg:pb-6">
      <header className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card/80 backdrop-blur-xl border border-border text-muted-foreground"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Veloxy</p>
            <h1 className="font-display text-xl font-black">Treinador</h1>
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              disabled={sending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card/80 text-muted-foreground transition hover:text-foreground disabled:opacity-50"
              aria-label="Limpar conversa"
              title="Limpar conversa"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </header>

      <div className={cn(GLASS_CARD_CLASS, "mx-4 mt-4 flex min-h-0 flex-1 flex-col overflow-hidden lg:mx-6")}>
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-3">
          <Bubble from="coach">
            <p className="whitespace-pre-wrap text-sm break-words">
              Oi, {firstName}! Sou seu treinador virtual. Pergunte sobre treinos, pace, provas, nutrição — ou
              sobre as suas corridas no Runnex.
            </p>
          </Bubble>

          {messages.map((message) => (
            <Bubble key={message.id} from={message.from}>
              <p className="whitespace-pre-wrap text-sm break-words">{message.text}</p>
            </Bubble>
          ))}

          {sending && (
            <Bubble from="coach">
              <Loader2 size={16} className="animate-spin text-purple-500" aria-label="Treinador digitando" />
            </Bubble>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar border-t border-border px-3 pt-3">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => send(suggestion)}
              disabled={sending}
              className="shrink-0 rounded-full border border-purple-500/25 bg-purple-500/10 px-3 py-1.5 text-xs font-bold text-purple-400 transition hover:bg-purple-500/20 disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Pergunte ao treinador..."
            maxLength={1000}
            className="flex-1 bg-secondary border border-input rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 transition"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            aria-label="Enviar mensagem"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-600 hover:bg-purple-700 transition disabled:opacity-50"
          >
            {sending ? <Loader2 size={16} className="animate-spin text-white" /> : <Send size={16} className="text-white" />}
          </button>
        </form>
      </div>
    </div>
  );
}
