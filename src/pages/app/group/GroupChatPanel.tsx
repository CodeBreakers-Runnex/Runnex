// Chat do grupo (antes dentro de Group.tsx).
import { useEffect, useRef, useState } from "react";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { sendGroupMessage, subscribeToGroupMessages } from "@/services/database";
import type { GroupMessage, RunningGroup } from "@/types";
import SafeAvatar from "@/components/SafeAvatar";
import { toDateSafe } from "@/lib/feed-utils";
import { GLASS_CARD_CLASS } from "@/components/GlassCard";
import { cn } from "@/lib/utils";
import LoadRetry from "@/components/LoadRetry";

function MessageBubble({ message, isOwn }: { message: GroupMessage; isOwn: boolean }) {
  const date = toDateSafe(message.createdAt);
  return (
    <div className={`flex items-end gap-2 ${isOwn ? "flex-row-reverse" : ""}`}>
      {!isOwn && (
        <SafeAvatar src={message.senderPhoto} name={message.senderName} className="h-7 w-7 rounded-full bg-secondary shrink-0" />
      )}
      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isOwn ? "bg-purple-600 text-white rounded-br-sm" : "bg-secondary/80 border border-input rounded-bl-sm"}`}>
        {!isOwn && <p className="mb-0.5 text-[10px] font-black text-purple-300">{message.senderName}</p>}
        <p className="whitespace-pre-wrap text-sm break-words">{message.text}</p>
        <p className={`mt-1 text-[9px] ${isOwn ? "text-purple-200" : "text-muted-foreground"}`}>
          {date ? format(date, "HH:mm", { locale: ptBR }) : ""}
        </p>
      </div>
    </div>
  );
}

export default function GroupChatPanel({ group, senderName, senderPhoto, userUid }: {
  group: RunningGroup;
  senderName: string;
  senderPhoto: string | null;
  userUid?: string;
}) {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToGroupMessages(group.id, (data) => {
      setMessages(data);
      setLoadError(false);
      setLoading(false);
    }, undefined, () => {
      setLoadError(true);
      setLoading(false);
    });
    return () => unsub();
  }, [group.id, attempt]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    if (!userUid || !text.trim()) return;
    setSending(true);
    try {
      await sendGroupMessage({
        groupId: group.id,
        senderId: userUid,
        senderName,
        senderPhoto,
        text,
      });
      setText("");
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      toast.error("Nao foi possivel enviar a mensagem.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={cn(GLASS_CARD_CLASS, "flex h-[calc(100svh-15.5rem)] lg:h-[calc(100svh-11rem)] flex-col overflow-hidden")}>
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="animate-spin text-purple-500" size={28} />
          </div>
        ) : loadError && messages.length === 0 ? (
          <LoadRetry
            className="h-full"
            message="Não foi possível carregar as mensagens."
            retryLabel="Tentar carregar as mensagens de novo"
            onRetry={() => setAttempt((a) => a + 1)}
          />
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <MessageSquare className="text-muted-foreground/50" size={30} />
            <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
              Nenhuma mensagem ainda. Diga oi!
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} isOwn={message.senderId === userUid} />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-border p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
          placeholder="Escreva uma mensagem..."
          maxLength={1000}
          className="flex-1 bg-secondary border border-input rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 transition"
        />
        <button
          onClick={handleSend}
          disabled={sending || !text.trim()}
          aria-label="Enviar mensagem"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-600 hover:bg-purple-700 transition disabled:opacity-50"
        >
          {sending ? <Loader2 size={16} className="animate-spin text-white" /> : <Send size={16} className="text-white" />}
        </button>
      </div>
    </div>
  );
}
