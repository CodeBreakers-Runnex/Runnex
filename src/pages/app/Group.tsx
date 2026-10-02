import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Heart,
  Image as ImageIcon,
  Loader2,
  LogOut,
  MessageCircle,
  MessageSquare,
  RefreshCw,
  Rss,
  Send,
  Settings,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  addGroupPostComment,
  createGroupPost,
  getGroupById,
  getUserProfile,
  joinGroup,
  leaveGroup,
  sendGroupMessage,
  subscribeToGroupMessages,
  subscribeToGroupPostComments,
  subscribeToGroupPosts,
  toggleGroupPostLike,
} from "@/services/database";
import { resizeImageToDataUrl } from "@/lib/image-resize";
import type { GroupMessage, GroupPost, GroupPostComment, RunningGroup, UserProfile } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import SafeAvatar from "@/components/SafeAvatar";
import { getBestUserPhotoURL } from "@/lib/user-photo";
import { formatCardDate, toDateSafe } from "@/lib/feed-utils";
import { GLASS_CARD_CLASS } from "@/components/GlassCard";
import { cn } from "@/lib/utils";

type GroupTab = "feed" | "chat";

function LoadingScreen() {
  return (
    <div className="app-shell flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-purple-500" size={40} />
      <p className="text-[10px] font-black text-muted-foreground tracking-[0.2em] uppercase">Carregando grupo...</p>
    </div>
  );
}

function StateScreen({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionLoading,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionLoading?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <div className="app-shell flex flex-col items-center justify-center gap-5 px-6 text-center safe-top">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-500">
        {icon}
      </div>
      <div>
        <p className="font-display text-xl font-black uppercase tracking-tighter">{title}</p>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/social")}
          className="rounded-xl border border-border bg-card/80 backdrop-blur-xl px-6 py-3 text-xs font-black uppercase tracking-widest text-foreground/80"
        >
          Voltar aos grupos
        </button>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            disabled={actionLoading}
            className="flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 transition px-6 py-3 text-xs font-black uppercase tracking-widest text-white disabled:opacity-60"
          >
            {actionLoading && <Loader2 size={14} className="animate-spin" />}
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function PostComposer({
  authorPhoto,
  authorName,
  onSubmit,
}: {
  authorPhoto: string | null;
  authorName: string;
  onSubmit: (text: string, imageFile: File | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const reset = () => {
    setText("");
    setImageFile(null);
    setImagePreview(null);
    setOpen(false);
  };

  const handleSubmit = async () => {
    if (!text.trim() && !imageFile) {
      toast.error("Escreva algo ou adicione uma imagem para publicar.");
      return;
    }
    setPosting(true);
    try {
      await onSubmit(text, imageFile);
      reset();
    } finally {
      setPosting(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-4 flex w-full items-center gap-3 rounded-2xl bg-card/80 backdrop-blur-xl border border-border p-4 text-left"
      >
        <SafeAvatar src={authorPhoto} name={authorName} className="h-9 w-9 rounded-full bg-secondary shrink-0" />
        <span className="text-sm text-muted-foreground">O que você quer compartilhar com o grupo?</span>
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(GLASS_CARD_CLASS, "mb-4 rounded-2xl p-4")}
    >
      <div className="flex items-start gap-3">
        <SafeAvatar src={authorPhoto} name={authorName} className="h-9 w-9 rounded-full bg-secondary shrink-0" />
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="O que você quer compartilhar com o grupo?"
          rows={3}
          maxLength={1000}
          className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
        />
      </div>

      {imagePreview && (
        <div className="relative mt-3 ml-12 overflow-hidden rounded-2xl border border-border">
          <img src={imagePreview} alt="Pré-visualização" className="max-h-52 w-full object-cover" />
          <button
            onClick={() => { setImageFile(null); setImagePreview(null); }}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white"
            aria-label="Remover imagem"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="mt-3 ml-12 flex items-center justify-between">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 rounded-xl border border-border bg-secondary/60 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground"
        >
          <ImageIcon size={14} className="text-purple-400" />
          Imagem
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={reset}
            disabled={posting}
            className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={posting}
            className="flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 transition px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-60"
          >
            {posting ? <Loader2 size={13} className="animate-spin" /> : null}
            Publicar
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function PostComments({ groupId, postId }: { groupId: string; postId: string }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<GroupPostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const unsub = subscribeToGroupPostComments(groupId, postId, (data) => {
      setComments(data);
      setLoading(false);
    });
    return () => unsub();
  }, [groupId, postId]);

  const handleSend = async () => {
    if (!user || !text.trim()) return;
    setSending(true);
    try {
      await addGroupPostComment(groupId, postId, {
        authorId: user.uid,
        authorName: user.displayName || "Corredor",
        authorPhoto: getBestUserPhotoURL(user),
        text,
      });
      setText("");
    } catch (error) {
      console.error("Erro ao comentar:", error);
      toast.error("Nao foi possivel enviar o comentario.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-3 border-t border-border/70 pt-3">
      {loading ? (
        <div className="flex justify-center py-3">
          <Loader2 size={16} className="animate-spin text-purple-500" />
        </div>
      ) : comments.length === 0 ? (
        <p className="py-2 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
          Nenhum comentário ainda
        </p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="flex items-start gap-2.5">
              <SafeAvatar src={comment.authorPhoto} name={comment.authorName} className="h-7 w-7 rounded-full bg-secondary shrink-0" />
              <div className="min-w-0 flex-1 rounded-2xl bg-secondary/60 border border-input px-3 py-2">
                <p className="text-[11px] font-black">{comment.authorName}</p>
                <p className="text-xs text-foreground/80 break-words">{comment.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
          placeholder="Escreva um comentário..."
          maxLength={500}
          className="flex-1 bg-secondary border border-input rounded-xl px-3 py-2.5 text-xs outline-none focus:border-purple-500 transition"
        />
        <button
          onClick={handleSend}
          disabled={sending || !text.trim()}
          aria-label="Enviar comentário"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-600 hover:bg-purple-700 transition disabled:opacity-50"
        >
          {sending ? <Loader2 size={14} className="animate-spin text-white" /> : <Send size={14} className="text-white" />}
        </button>
      </div>
    </div>
  );
}

function PostCard({ post, groupId, userUid }: { post: GroupPost; groupId: string; userUid?: string }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const isLiked = Boolean(userUid && post.likes.includes(userUid));

  const handleLike = async () => {
    if (!userUid) return;
    try {
      await toggleGroupPostLike(groupId, post.id, userUid, isLiked);
    } catch (error) {
      console.error("Erro ao curtir publicacao:", error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(GLASS_CARD_CLASS, "mb-4 p-4")}
    >
      <div className="flex items-center gap-3">
        <SafeAvatar src={post.authorPhoto} name={post.authorName} className="h-10 w-10 rounded-full bg-secondary shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-sm font-black">{post.authorName}</p>
          <p className="text-[10px] text-muted-foreground">{formatCardDate(post.createdAt)}</p>
        </div>
      </div>

      {post.text && <p className="mt-3 whitespace-pre-wrap text-sm text-foreground/90 break-words">{post.text}</p>}

      {post.imageURL && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-border">
          <img src={post.imageURL} alt="Publicação do grupo" className="max-h-96 w-full object-cover" />
        </div>
      )}

      <div className="mt-4 flex items-center gap-5">
        <button onClick={handleLike} className="flex items-center gap-1.5 group" aria-label={isLiked ? "Descurtir" : "Curtir"}>
          <Heart
            size={18}
            className={`transition-all ${isLiked ? "text-purple-500 fill-current" : "text-muted-foreground group-hover:text-purple-400"}`}
          />
          <span className={`text-xs font-bold tabular-nums ${isLiked ? "text-purple-400" : "text-muted-foreground"}`}>
            {post.likes.length}
          </span>
        </button>

        <button onClick={() => setCommentsOpen((v) => !v)} className="flex items-center gap-1.5 group" aria-label="Comentários">
          <MessageCircle size={18} className={`transition-all ${commentsOpen ? "text-purple-400" : "text-muted-foreground group-hover:text-purple-400"}`} />
          <span className={`text-xs font-bold tabular-nums ${commentsOpen ? "text-purple-400" : "text-muted-foreground"}`}>
            {post.commentsCount}
          </span>
        </button>
      </div>

      {commentsOpen && <PostComments groupId={groupId} postId={post.id} />}
    </motion.div>
  );
}

function GroupFeedPanel({ group, authorName, authorPhoto, userUid }: {
  group: RunningGroup;
  authorName: string;
  authorPhoto: string | null;
  userUid?: string;
}) {
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToGroupPosts(group.id, (data) => {
      setPosts(data);
      setLoading(false);
    });
    return () => unsub();
  }, [group.id]);

  const handleSubmitPost = useCallback(async (text: string, imageFile: File | null) => {
    if (!userUid) return;
    try {
      let imageURL: string | null = null;
      if (imageFile) {
        imageURL = await resizeImageToDataUrl(imageFile);
      }
      await createGroupPost({
        groupId: group.id,
        authorId: userUid,
        authorName,
        authorPhoto,
        text,
        imageURL,
      });
      toast.success("Publicado no grupo!");
    } catch (error) {
      console.error("Erro ao publicar no grupo:", error);
      toast.error("Nao foi possivel publicar agora.");
      throw error;
    }
  }, [group.id, userUid, authorName, authorPhoto]);

  return (
    <div>
      <PostComposer authorPhoto={authorPhoto} authorName={authorName} onSubmit={handleSubmitPost} />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-purple-500" size={30} />
        </div>
      ) : posts.length === 0 ? (
        <div className={cn(GLASS_CARD_CLASS, "p-10 text-center")}>
          <Rss className="mx-auto text-muted-foreground/50" size={32} />
          <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
            Nenhuma publicação ainda. Seja o primeiro a compartilhar!
          </p>
        </div>
      ) : (
        <AnimatePresence>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} groupId={group.id} userUid={userUid} />
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}

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

function GroupChatPanel({ group, senderName, senderPhoto, userUid }: {
  group: RunningGroup;
  senderName: string;
  senderPhoto: string | null;
  userUid?: string;
}) {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToGroupMessages(group.id, (data) => {
      setMessages(data);
      setLoading(false);
    });
    return () => unsub();
  }, [group.id]);

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

function GroupOptionsModal({ open, onClose, group, onLeave, leaving }: {
  open: boolean;
  onClose: () => void;
  group: RunningGroup;
  onLeave: () => void;
  leaving: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[1100] bg-background/80 backdrop-blur-md"
          />
          <div className="fixed inset-0 z-[1200] flex items-end lg:items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className={cn(GLASS_CARD_CLASS, "w-full max-w-md p-5 pointer-events-auto")}
            >
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-display text-xl font-black text-purple-500">OPÇÕES DO GRUPO</h2>
                <button onClick={onClose} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-muted-foreground" aria-label="Fechar">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-border bg-secondary/50 p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Cidade</p>
                  <p className="text-sm font-bold">{group.city}</p>
                </div>
                <div className="rounded-2xl border border-border bg-secondary/50 p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Criado por</p>
                  <p className="text-sm font-bold">{group.creatorName}</p>
                </div>

                <button
                  onClick={onLeave}
                  disabled={leaving}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 py-4 text-xs font-black uppercase tracking-widest text-red-400 disabled:opacity-60"
                >
                  {leaving ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                  Sair do grupo
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function Group() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [group, setGroup] = useState<RunningGroup | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [mobileTab, setMobileTab] = useState<GroupTab>("feed");
  const [optionsOpen, setOptionsOpen] = useState(false);

  const loadGroup = useCallback(async () => {
    if (!groupId || !user) return;
    setLoading(true);
    setLoadError(false);
    try {
      const [groupData, profileData] = await Promise.all([
        getGroupById(groupId),
        getUserProfile(user.uid),
      ]);
      setGroup(groupData);
      setProfile(profileData);
    } catch (error) {
      console.error("Erro ao carregar grupo:", error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [groupId, user]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  const displayName = user?.displayName || "Corredor";
  const userPhotoURL = getBestUserPhotoURL(user);

  const isMember = Boolean(
    user &&
    groupId &&
    (
      (profile?.joinedGroupIds || []).includes(groupId) ||
      group?.memberIds.includes(user.uid)
    )
  );
  const isDemoGroup = group?.createdBy === "system";

  const handleJoin = async () => {
    if (!user || !groupId) return;
    setJoining(true);
    try {
      await joinGroup(groupId, user.uid);
      toast.success("Você entrou no grupo.");
      await loadGroup();
    } catch (error) {
      console.error("Erro ao entrar no grupo:", error);
      toast.error("Não foi possível entrar no grupo.");
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!user || !groupId) return;
    setLeaving(true);
    try {
      await leaveGroup(groupId, user.uid);
      toast.success("Você saiu do grupo.");
      navigate("/social");
    } catch (error) {
      console.error("Erro ao sair do grupo:", error);
      toast.error("Não foi possível sair do grupo.");
    } finally {
      setLeaving(false);
    }
  };

  if (!groupId) {
    return (
      <StateScreen
        icon={<AlertTriangle size={30} />}
        title="Grupo não encontrado"
        description="O link acessado não aponta para um grupo válido."
      />
    );
  }

  if (loading) return <LoadingScreen />;

  if (loadError) {
    return (
      <StateScreen
        icon={<AlertTriangle size={30} />}
        title="Erro ao carregar dados"
        description="Não conseguimos carregar as informações desse grupo agora."
        actionLabel="Tentar novamente"
        onAction={loadGroup}
      />
    );
  }

  if (!group) {
    return (
      <StateScreen
        icon={<Users size={30} />}
        title="Grupo não encontrado"
        description="Esse grupo não existe mais ou o link está incorreto."
      />
    );
  }

  if (!isMember) {
    return (
      <div className="app-shell relative flex flex-col items-center justify-center gap-5 px-6 text-center safe-top">
        <button
          onClick={() => navigate("/social")}
          className="absolute left-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-card/80 backdrop-blur-xl border border-border text-muted-foreground"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </button>

        <SafeAvatar src={group.photoURL} name={group.name} className="h-24 w-24 rounded-3xl border border-purple-500/20 bg-card" fallbackClassName="text-2xl font-black text-purple-500" />

        <div>
          <p className="font-display text-2xl font-black uppercase tracking-tighter">{group.name}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">{group.city} · {group.membersCount} membros</p>
          {group.description && <p className="mt-3 max-w-xs text-sm text-muted-foreground">{group.description}</p>}
        </div>

        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/70">Você ainda não participa deste grupo</p>

        <button
          onClick={handleJoin}
          disabled={joining}
          className="flex items-center gap-2 rounded-2xl bg-purple-600 hover:bg-purple-700 transition px-8 py-4 text-xs font-black uppercase tracking-widest text-white disabled:opacity-60"
        >
          {joining ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
          Entrar no grupo
        </button>
      </div>
    );
  }

  return (
    <div className="app-shell pb-24 safe-top">
      <header className="bg-card/80 backdrop-blur-xl border-b border-border sticky top-0 z-40 px-5 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/social")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card/80 backdrop-blur-xl border border-border text-muted-foreground"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </button>

          <SafeAvatar src={group.photoURL} name={group.name} className="h-12 w-12 shrink-0 rounded-2xl border border-purple-500/30 bg-card" imageClassName="rounded-2xl" />

          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-xl font-black">{group.name}</h1>
            <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <Users size={11} className="text-purple-500" /> {group.membersCount} membros
            </p>
          </div>

          <button
            onClick={() => setOptionsOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card/80 backdrop-blur-xl border border-border text-muted-foreground"
            aria-label="Opções do grupo"
          >
            <Settings size={18} />
          </button>
        </div>

        {group.description && (
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{group.description}</p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 lg:hidden">
          {([
            { id: "feed" as const, label: "Feed", icon: Rss },
            { id: "chat" as const, label: "Chat", icon: MessageSquare },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-[10px] font-black uppercase tracking-widest transition ${
                mobileTab === tab.id ? "bg-purple-600 text-white" : "bg-card/80 backdrop-blur-xl border border-border text-muted-foreground"
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {isDemoGroup ? (
        <div className="px-5 pt-8">
          <div className={cn(GLASS_CARD_CLASS, "p-8 text-center")}>
            <RefreshCw className="mx-auto text-muted-foreground/50" size={30} />
            <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
              Este é um grupo de demonstração
            </p>
            <p className="mt-2 text-xs text-muted-foreground/70">
              Feed e chat ficam disponíveis em grupos criados de verdade. Crie um grupo para usar essas funções.
            </p>
          </div>
        </div>
      ) : (
        <main className="px-5 pt-5 lg:mx-auto lg:max-w-5xl lg:grid lg:grid-cols-2 lg:gap-5">
          <div className={mobileTab === "feed" ? "block" : "hidden lg:block"}>
            <GroupFeedPanel group={group} authorName={displayName} authorPhoto={userPhotoURL} userUid={user?.uid} />
          </div>
          <div className={mobileTab === "chat" ? "block" : "hidden lg:block"}>
            <GroupChatPanel group={group} senderName={displayName} senderPhoto={userPhotoURL} userUid={user?.uid} />
          </div>
        </main>
      )}

      <GroupOptionsModal
        open={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        group={group}
        onLeave={handleLeave}
        leaving={leaving}
      />
    </div>
  );
}
