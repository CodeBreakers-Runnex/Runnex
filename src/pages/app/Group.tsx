import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  MessageSquare,
  RefreshCw,
  Rss,
  Settings,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { getGroupById, getUserProfile, joinGroup, leaveGroup } from "@/services/database";
import type { RunningGroup, UserProfile } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import SafeAvatar from "@/components/SafeAvatar";
import { getBestUserPhotoURL } from "@/lib/user-photo";
import { GLASS_CARD_CLASS } from "@/components/GlassCard";
import { cn } from "@/lib/utils";
import { LoadingScreen, StateScreen } from "@/pages/app/group/GroupStateScreens";
import GroupFeedPanel from "@/pages/app/group/GroupFeedPanel";
import GroupChatPanel from "@/pages/app/group/GroupChatPanel";
import GroupOptionsModal from "@/pages/app/group/GroupOptionsModal";

type GroupTab = "feed" | "chat";

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
          className="absolute left-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-card border border-border text-muted-foreground"
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
      <header className="bg-card border-b border-border sticky top-0 z-40 px-5 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/social")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card border border-border text-muted-foreground"
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card border border-border text-muted-foreground"
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
                mobileTab === tab.id ? "bg-purple-600 text-white" : "bg-card border border-border text-muted-foreground"
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
