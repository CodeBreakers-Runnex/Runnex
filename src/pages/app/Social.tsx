import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Camera,
  ChevronDown,
  Loader2,
  MapPin,
  Plus,
  Rss,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import Feed from "@/pages/app/Feed";
import Events from "@/pages/app/Events";
import {
  createGroup,
  getGlobalRanking,
  getGroupActivities,
  getGroupLeaderboard,
  getGroups,
  getUserProfile,
  joinGroup,
  leaveGroup,
  updateGroupPhoto,
} from "@/services/database";
import { resizeImageToDataUrl } from "@/lib/image-resize";
import type { FeedActivity, RunningGroup, UserProfile } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import SafeAvatar from "@/components/SafeAvatar";
import { getBestUserPhotoURL } from "@/lib/user-photo";
import { toast } from "sonner";
import { formatCardDate } from "@/lib/feed-utils";
import { GLASS_CARD_CLASS } from "@/components/GlassCard";
import { cn } from "@/lib/utils";

type SocialTab = "feed" | "leaderboard" | "groups" | "events";

const RANKING_STEP = 100;
const RANKING_CAP = 500;

const socialTabs: Array<{ id: SocialTab; label: string; icon: typeof Rss }> = [
  { id: "feed", label: "Feed", icon: Rss },
  { id: "leaderboard", label: "Ranking", icon: Trophy },
  { id: "groups", label: "Grupos", icon: Users },
  { id: "events", label: "Eventos", icon: Calendar },
];

type GroupForm = {
  name: string;
  city: string;
  description: string;
  tag: string;
};

const EMPTY_GROUP_FORM: GroupForm = {
  name: "",
  city: "",
  description: "",
  tag: "",
};

function GroupCreateModal({
  open,
  onClose,
  onCreate,
  creating,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (form: GroupForm, avatarFile: File | null) => void;
  creating: boolean;
}) {
  const [form, setForm] = useState<GroupForm>(EMPTY_GROUP_FORM);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_GROUP_FORM);
      setAvatarFile(null);
      setAvatarPreview(null);
    }
  }, [open]);

  const handleAvatarSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1100] bg-background/80 backdrop-blur-md"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className={cn(GLASS_CARD_CLASS, "w-full max-w-lg max-h-[86svh] overflow-y-auto no-scrollbar p-5 pointer-events-auto")}
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">Comunidade</p>
                  <h2 className="font-display text-2xl font-black text-purple-500">CRIAR GRUPO</h2>
                </div>
                <button onClick={onClose} className="h-10 w-10 rounded-full bg-card/80 backdrop-blur-xl border border-border flex items-center justify-center text-muted-foreground" aria-label="Fechar">
                  <X size={18} />
                </button>
              </div>

              <div className="mb-5 flex justify-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative h-24 w-24 overflow-hidden rounded-3xl border border-border bg-secondary/60 flex items-center justify-center"
                  aria-label="Escolher foto do grupo"
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Preview do grupo" className="h-full w-full object-cover" />
                  ) : (
                    <Users size={28} className="text-muted-foreground/70" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
                    <Camera size={22} className="text-white" />
                  </div>
                </button>
              </div>

              <div className="space-y-4">
                {[
                  { key: "name", label: "Nome", placeholder: "Ex: Longao de domingo" },
                  { key: "city", label: "Cidade", placeholder: "Ex: Sao Paulo, SP" },
                  { key: "tag", label: "Tag", placeholder: "Ex: 10K" },
                ].map((field) => (
                  <label key={field.key} className="block">
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{field.label} *</span>
                    <input
                      required
                      value={form[field.key as keyof GroupForm]}
                      onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full bg-secondary border border-input rounded-xl px-4 py-4 text-sm outline-none focus:border-purple-500 transition"
                    />
                  </label>
                ))}

                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Descricao *</span>
                  <textarea
                    required
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Conte o objetivo do grupo"
                    rows={3}
                    className="w-full resize-none bg-secondary border border-input rounded-xl px-4 py-4 text-sm outline-none focus:border-purple-500 transition"
                  />
                </label>
              </div>

              <button
                onClick={() => onCreate(form, avatarFile)}
                disabled={creating}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 transition py-4 text-xs font-black uppercase tracking-widest text-white disabled:opacity-60"
              >
                {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Criar comunidade
              </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function Social() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SocialTab>("feed");
  const [rankingLimit, setRankingLimit] = useState(RANKING_STEP);
  const [ranking, setRanking] = useState<UserProfile[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [groups, setGroups] = useState<RunningGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [joinedGroups, setJoinedGroups] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupFeed, setGroupFeed] = useState<FeedActivity[]>([]);
  const [groupLeaderboard, setGroupLeaderboard] = useState<UserProfile[]>([]);
  const [groupDetailsLoading, setGroupDetailsLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const displayName = user?.displayName || "Corredor";
  const userPhotoURL = getBestUserPhotoURL(user);
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) || null;

  const loadGroups = useCallback(async () => {
    if (!user) return;
    setGroupsLoading(true);
    try {
      const [profile, groupList] = await Promise.all([
        getUserProfile(user.uid),
        getGroups(),
      ]);
      const joined = profile?.joinedGroupIds || [];
      setJoinedGroups(joined);
      setGroups(groupList);
      setSelectedGroupId((current) => current || joined[0] || groupList[0]?.id || null);
    } finally {
      setGroupsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === "groups") loadGroups();
  }, [activeTab, loadGroups]);

  useEffect(() => {
    if (activeTab !== "leaderboard") return;
    let cancelled = false;

    const loadRanking = async () => {
      setRankingLoading(true);
      try {
        const data = await getGlobalRanking(rankingLimit);
        if (!cancelled) setRanking(data);
      } finally {
        if (!cancelled) setRankingLoading(false);
      }
    };

    loadRanking();
    return () => {
      cancelled = true;
    };
  }, [activeTab, rankingLimit]);

  useEffect(() => {
    if (activeTab !== "groups" || !selectedGroup) return;
    let cancelled = false;

    const loadDetails = async () => {
      setGroupDetailsLoading(true);
      try {
        const [feed, leaderboard] = await Promise.all([
          getGroupActivities(selectedGroup),
          getGroupLeaderboard(selectedGroup),
        ]);
        if (!cancelled) {
          setGroupFeed(feed);
          setGroupLeaderboard(leaderboard);
        }
      } finally {
        if (!cancelled) setGroupDetailsLoading(false);
      }
    };

    loadDetails();
    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedGroup]);

  const userPosition = useMemo(() => {
    if (!user) return null;
    const index = ranking.findIndex((item) => item.uid === user.uid);
    return index >= 0 ? index + 1 : null;
  }, [ranking, user]);

  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null);

  const handleJoinGroup = async (group: RunningGroup) => {
    if (!user) return;
    setJoiningGroupId(group.id);
    try {
      await joinGroup(group.id, user.uid);
      setJoinedGroups((prev) => [...prev, group.id]);
      toast.success("Voce entrou no grupo.");
      navigate(`/grupo/${group.id}`);
    } catch (error) {
      console.error("Erro ao entrar no grupo:", error);
      toast.error("Nao foi possivel entrar no grupo.");
    } finally {
      setJoiningGroupId(null);
    }
  };

  const handleLeaveGroup = async (group: RunningGroup) => {
    if (!user) return;
    try {
      await leaveGroup(group.id, user.uid);
      setJoinedGroups((prev) => prev.filter((id) => id !== group.id));
      toast.success("Voce saiu do grupo.");
      await loadGroups();
    } catch (error) {
      console.error("Erro ao sair do grupo:", error);
      toast.error("Nao foi possivel sair do grupo.");
    }
  };

  const handleCreateGroup = async (form: GroupForm, avatarFile: File | null) => {
    if (!user) return;

    const name = form.name.trim();
    const city = form.city.trim();
    const description = form.description.trim();
    const tag = form.tag.trim();

    if (name.length < 3) {
      toast.error("O nome do grupo precisa ter pelo menos 3 letras.");
      return;
    }
    if (!city) {
      toast.error("Informe a cidade do grupo.");
      return;
    }
    if (!description) {
      toast.error("Escreva uma descricao para o grupo.");
      return;
    }
    if (!tag) {
      toast.error("Informe uma tag para o grupo.");
      return;
    }

    setCreatingGroup(true);
    try {
      const groupId = await createGroup({
        name,
        city,
        description,
        tag,
        userId: user.uid,
        userName: displayName,
      });

      if (avatarFile) {
        try {
          const dataUrl = await resizeImageToDataUrl(avatarFile);
          await updateGroupPhoto(groupId, dataUrl);
        } catch (avatarError) {
          console.warn("Nao foi possivel enviar a foto do grupo:", avatarError);
          toast.warning("Grupo criado, mas a foto nao pode ser enviada agora.");
        }
      }

      setCreateOpen(false);
      setSelectedGroupId(groupId);
      toast.success("Comunidade criada.");
      await loadGroups();
    } catch (error) {
      console.error("Erro ao criar grupo:", error);
      toast.error("Nao foi possivel criar a comunidade.");
    } finally {
      setCreatingGroup(false);
    }
  };

  return (
    <div className="app-shell pb-28 safe-top">
      <header className="bg-card/80 backdrop-blur-xl border-b border-border sticky top-0 z-50 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SafeAvatar src={userPhotoURL} name={displayName} alt="Perfil" className="h-11 w-11 rounded-full border border-purple-500/30 bg-card" />
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground/70">Veloxy</p>
              <h1 className="font-display text-2xl font-black tracking-tighter text-purple-500">SOCIAL</h1>
            </div>
          </div>

          <div className="rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-2 text-right">
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-purple-300">Ranking</p>
            <p className="text-xs font-black">{userPosition ? `#${userPosition}` : "--"}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {socialTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-[9px] font-black uppercase transition ${
                activeTab === tab.id ? "bg-purple-600 text-white" : "bg-card/80 backdrop-blur-xl border border-border text-muted-foreground"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.main
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
          className="px-5 pt-6"
        >
          {activeTab === "feed" && <Feed embedded />}
          {activeTab === "leaderboard" && (
            <section>
              <div className={cn(GLASS_CARD_CLASS, "mb-5 p-5")}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.22em] text-purple-300">Leaderboard</p>
                    <h2 className="mt-1 font-display text-3xl font-black">Top corredores</h2>
                  </div>
                  <Trophy size={28} className="text-purple-400" />
                </div>
              </div>

              <div className="space-y-3">
                {rankingLoading && ranking.length === 0 ? (
                  <div className="flex items-center justify-center py-24">
                    <Loader2 className="animate-spin text-purple-500" size={32} />
                  </div>
                ) : ranking.length === 0 ? (
                  <div className={cn(GLASS_CARD_CLASS, "p-10 text-center")}>
                    <Trophy className="mx-auto text-muted-foreground/50" size={36} />
                    <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Ranking vazio por enquanto</p>
                  </div>
                ) : (
                  ranking.map((athlete, index) => (
                    <AthleteRow key={athlete.uid} athlete={athlete} index={index} active={athlete.uid === user?.uid} />
                  ))
                )}
              </div>

              {ranking.length > 0 && rankingLimit < RANKING_CAP && (
                <button
                  onClick={() => setRankingLimit((value) => Math.min(value + RANKING_STEP, RANKING_CAP))}
                  disabled={rankingLoading}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-card/80 backdrop-blur-xl border border-border py-4 text-xs font-black uppercase tracking-widest text-foreground/80 disabled:opacity-60"
                >
                  {rankingLoading ? <Loader2 size={14} className="animate-spin text-purple-500" /> : <ChevronDown size={14} className="text-purple-500" />}
                  Ver mais
                </button>
              )}
            </section>
          )}

          {activeTab === "groups" && (
            <section>
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Comunidades</p>
                  <h2 className="mt-1 font-display text-3xl font-black">Grupos reais</h2>
                </div>
                <button
                  onClick={() => setCreateOpen(true)}
                  className="bg-purple-600 text-white flex h-11 w-11 items-center justify-center rounded-2xl"
                  aria-label="Criar grupo"
                >
                  <Plus size={18} />
                </button>
              </div>

              {groupsLoading ? (
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="animate-spin text-purple-500" size={32} />
                </div>
              ) : (
                <>
                  <div className="mb-5 flex gap-3 overflow-x-auto no-scrollbar">
                    {groups.map((group) => (
                      <button
                        key={group.id}
                        onClick={() => setSelectedGroupId(group.id)}
                        className={`min-w-[180px] rounded-2xl p-4 text-left transition ${
                          selectedGroupId === group.id ? "border border-purple-500/50 bg-purple-500/15" : "bg-card/80 backdrop-blur-xl border border-border"
                        }`}
                      >
                        <p className="truncate font-display text-lg font-black">{group.name}</p>
                        <p className="mt-1 flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                          <MapPin size={10} className="text-purple-500" />
                          {group.city}
                        </p>
                        <p className="mt-3 text-[10px] font-black text-purple-400">{group.membersCount + (joinedGroups.includes(group.id) && !group.memberIds.includes(user?.uid || "") ? 1 : 0)} membros</p>
                      </button>
                    ))}
                  </div>

                  {selectedGroup && (
                    <div className="space-y-5">
                      <div className={cn(GLASS_CARD_CLASS, "p-5")}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="mb-2 inline-flex rounded-full border border-purple-500/25 bg-purple-500/10 px-3 py-1 text-[9px] font-black uppercase text-purple-300">
                              {selectedGroup.tag}
                            </div>
                            <h3 className="font-display text-2xl font-black">{selectedGroup.name}</h3>
                            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{selectedGroup.description || "Grupo de corrida no Veloxy."}</p>
                          </div>
                          <Users size={28} className="text-purple-500" />
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-3">
                          <div className="rounded-2xl bg-secondary/60 border border-input p-3">
                            <p className="font-display text-2xl font-black">{selectedGroup.membersCount}</p>
                            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-muted-foreground/70">membros</p>
                          </div>
                          <div className="rounded-2xl bg-secondary/60 border border-input p-3">
                            <p className="font-display text-2xl font-black">{selectedGroup.weeklyKm.toFixed(0)}</p>
                            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-muted-foreground/70">km semanais</p>
                          </div>
                        </div>

                        <button
                          onClick={() =>
                            joinedGroups.includes(selectedGroup.id)
                              ? handleLeaveGroup(selectedGroup)
                              : handleJoinGroup(selectedGroup)
                          }
                          disabled={joiningGroupId === selectedGroup.id}
                          className={`mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-xs font-black uppercase tracking-widest transition disabled:opacity-60 ${
                            joinedGroups.includes(selectedGroup.id) ? "border border-green-500/30 bg-green-500/10 text-green-400" : "bg-purple-600 text-white"
                          }`}
                        >
                          {joiningGroupId === selectedGroup.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Zap size={14} />
                          )}
                          {joinedGroups.includes(selectedGroup.id) ? "Sair do grupo" : "Entrar no grupo"}
                        </button>

                        {joinedGroups.includes(selectedGroup.id) && (
                          <button
                            onClick={() => navigate(`/grupo/${selectedGroup.id}`)}
                            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-purple-500/30 bg-purple-500/10 py-4 text-xs font-black uppercase tracking-widest text-purple-300 transition"
                          >
                            <Users size={14} />
                            Abrir grupo
                          </button>
                        )}
                      </div>

                      <div className={cn(GLASS_CARD_CLASS, "p-5")}>
                        <h4 className="font-display text-lg font-black">Ranking do grupo</h4>
                        <div className="mt-4 space-y-3">
                          {groupDetailsLoading ? (
                            <Loader2 className="mx-auto animate-spin text-purple-500" size={24} />
                          ) : groupLeaderboard.length === 0 ? (
                            <p className="py-5 text-center text-xs font-black uppercase tracking-[0.16em] text-muted-foreground/70">Entre no grupo para iniciar o ranking</p>
                          ) : (
                            groupLeaderboard.slice(0, 5).map((athlete, index) => <AthleteRow key={athlete.uid} athlete={athlete} index={index} active={athlete.uid === user?.uid} compact />)
                          )}
                        </div>
                      </div>

                      <div className={cn(GLASS_CARD_CLASS, "p-5")}>
                        <h4 className="font-display text-lg font-black">Feed do grupo</h4>
                        <div className="mt-4 space-y-3">
                          {groupDetailsLoading ? (
                            <Loader2 className="mx-auto animate-spin text-purple-500" size={24} />
                          ) : groupFeed.length === 0 ? (
                            <p className="py-5 text-center text-xs font-black uppercase tracking-[0.16em] text-muted-foreground/70">Sem corridas recentes neste grupo</p>
                          ) : (
                            groupFeed.map((activity) => (
                              <div key={activity.id} className={cn(GLASS_CARD_CLASS, "rounded-2xl p-4")}>
                                <div className="flex items-center justify-between gap-4">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-black">{activity.userName}</p>
                                    <p className="text-[10px] text-muted-foreground">{formatCardDate(activity.timestamp, activity.createdAtMs)}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-display text-xl font-black text-purple-400">{activity.distance.toFixed(2)}</p>
                                    <p className="text-[8px] font-black uppercase tracking-[0.18em] text-muted-foreground/70">km</p>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {activeTab === "events" && <Events embedded />}
        </motion.main>
      </AnimatePresence>

      <GroupCreateModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={handleCreateGroup} creating={creatingGroup} />
    </div>
  );
}

function AthleteRow({
  athlete,
  index,
  active,
  compact = false,
}: {
  athlete: UserProfile;
  index: number;
  active: boolean;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center gap-4 rounded-2xl ${compact ? "p-3 bg-card/80 backdrop-blur-xl border border-border" : "p-4"} ${active ? "border border-purple-500/35 bg-purple-500/10" : "bg-card/80 backdrop-blur-xl border border-border"}`}>
      <div className="w-8 text-center font-display text-xl font-black text-purple-400">{index + 1}</div>
      <SafeAvatar src={athlete.photoURL} name={athlete.displayName || "Atleta"} className="h-11 w-11 rounded-2xl bg-card" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black">{athlete.displayName || "Atleta"}</p>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{athlete.level || "Iniciante"}</p>
      </div>
      <div className="text-right">
        <p className="font-display text-lg font-black">{(athlete.totalXP || 0).toLocaleString("pt-BR")}</p>
        <p className="text-[8px] font-black uppercase tracking-[0.18em] text-purple-400">XP</p>
      </div>
    </div>
  );
}
