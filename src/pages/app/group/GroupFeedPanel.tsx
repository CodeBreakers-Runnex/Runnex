// Feed do grupo: publicar, curtir e comentar (antes dentro de Group.tsx).
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Rss,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  addGroupPostComment,
  createGroupPost,
  subscribeToGroupPostComments,
  subscribeToGroupPosts,
  toggleGroupPostLike,
} from "@/services/database";
import { resizeImageToDataUrl } from "@/lib/image-resize";
import type { GroupPost, GroupPostComment, RunningGroup } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import SafeAvatar from "@/components/SafeAvatar";
import { getBestUserPhotoURL } from "@/lib/user-photo";
import { formatCardDate } from "@/lib/feed-utils";
import { GLASS_CARD_CLASS } from "@/components/GlassCard";
import { cn } from "@/lib/utils";

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
        className="mb-4 flex w-full items-center gap-3 rounded-2xl bg-card border border-border p-4 text-left"
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

export default function GroupFeedPanel({ group, authorName, authorPhoto, userUid }: {
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
