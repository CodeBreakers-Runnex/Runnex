import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Footprints,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { api } from "@/services/apiClient";
import {
  assignActivityShoe,
  createShoe,
  getShoes,
  shoeInput,
  updateShoe,
} from "@/services/shoesApi";
import type { FeedActivity, RunningShoe, ShoeInput } from "@/types";
import ShoeStatusBadge from "@/components/ShoeStatusBadge";
import { GLASS_CARD_CLASS } from "@/components/GlassCard";
import { cn } from "@/lib/utils";
import { toDateSafe } from "@/lib/feed-utils";

const km = (value: number) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Não foi possível carregar seus tênis.";

const emptyShoe: ShoeInput = {
  name: "",
  brand: null,
  model: null,
  purchaseDate: null,
  initialKm: 0,
  limitKm: 600,
  isDefault: false,
  manuallyWorn: false,
  retired: false,
};

function ShoeForm({
  shoe,
  firstShoe,
  busy,
  onSave,
  onClose,
}: {
  shoe: RunningShoe | null;
  firstShoe: boolean;
  busy: boolean;
  onSave: (values: ShoeInput) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<ShoeInput>(() =>
    shoe ? shoeInput(shoe) : { ...emptyShoe, isDefault: firstShoe },
  );
  const set = <K extends keyof ShoeInput>(key: K, value: ShoeInput[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));
  const inputClass =
    "mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!values.name.trim()) {
      toast.error("Informe um nome para o tênis.");
      return;
    }
    if (
      !Number.isFinite(values.initialKm) ||
      !Number.isFinite(values.limitKm) ||
      values.initialKm < 0 ||
      values.limitKm <= 0
    ) {
      toast.error(
        "Informe uma quilometragem válida e um limite maior que zero.",
      );
      return;
    }
    onSave({
      ...values,
      name: values.name.trim(),
      brand: values.brand?.trim() || null,
      model: values.model?.trim() || null,
    });
  };

  return (
    <section
      className={cn(GLASS_CARD_CLASS, "p-5")}
      aria-labelledby="shoe-form-title"
    >
      <div className="mb-5 flex items-center justify-between">
        <h2 id="shoe-form-title" className="font-display text-xl font-black">
          {shoe ? "Editar tênis" : "Cadastrar tênis"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Fechar cadastro de tênis"
          className="rounded-xl p-2 text-muted-foreground"
        >
          <X size={20} />
        </button>
      </div>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold sm:col-span-2">
          Nome do tênis
          <input
            autoFocus
            required
            maxLength={80}
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            className={inputClass}
            placeholder="Meu tênis de treino"
          />
        </label>
        <label className="text-sm font-bold">
          Marca
          <input
            maxLength={80}
            value={values.brand ?? ""}
            onChange={(e) => set("brand", e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="text-sm font-bold">
          Modelo
          <input
            maxLength={80}
            value={values.model ?? ""}
            onChange={(e) => set("model", e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="text-sm font-bold">
          Data de compra (opcional)
          <input
            type="date"
            value={values.purchaseDate ?? ""}
            onChange={(e) => set("purchaseDate", e.target.value || null)}
            className={inputClass}
          />
        </label>
        <label className="text-sm font-bold">
          Quilômetros anteriores ao app
          <input
            required
            type="number"
            min="0"
            max="1000000"
            step="0.01"
            value={values.initialKm}
            onChange={(e) => set("initialKm", e.target.valueAsNumber)}
            className={inputClass}
          />
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            Inclua somente o uso que não está nas corridas vinculadas.
          </span>
        </label>
        <label className="text-sm font-bold sm:col-span-2">
          Limite de uso em quilômetros
          <input
            required
            type="number"
            min="0.01"
            max="100000"
            step="0.01"
            value={values.limitKm}
            onChange={(e) => set("limitKm", e.target.valueAsNumber)}
            className={inputClass}
          />
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            600 km é um valor inicial editável. Ajuste conforme seu tênis e a
            orientação do fabricante.
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.isDefault}
            disabled={values.retired}
            onChange={(e) => set("isDefault", e.target.checked)}
          />{" "}
          Usar como tênis padrão
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.manuallyWorn}
            onChange={(e) => set("manuallyWorn", e.target.checked)}
          />{" "}
          Já percebi desgaste neste tênis
        </label>
        {shoe && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={values.retired}
              onChange={(e) =>
                setValues((prev) => ({
                  ...prev,
                  retired: e.target.checked,
                  isDefault: e.target.checked ? false : prev.isDefault,
                }))
              }
            />{" "}
            Aposentar tênis e preservar seu histórico
          </label>
        )}
        <button
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground disabled:opacity-50 sm:col-span-2"
        >
          {busy && <Loader2 size={18} className="animate-spin" />}{" "}
          {busy ? "Salvando..." : "Salvar tênis"}
        </button>
      </form>
    </section>
  );
}

export default function Shoes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.uid;
  const scopeRef = useRef(uid);
  scopeRef.current = uid;
  const [loadedUid, setLoadedUid] = useState<string>();
  const [storedShoes, setShoes] = useState<RunningShoe[]>([]);
  const [storedActivities, setActivities] = useState<FeedActivity[]>([]);
  const shoes = loadedUid === uid ? storedShoes : [];
  const activities = loadedUid === uid ? storedActivities : [];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RunningShoe | null>(null);
  const [busy, setBusy] = useState(false);
  const [showRetired, setShowRetired] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);

  useEffect(() => { setEditing(null); setBusy(false); setAssigning(null); }, [uid]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setFormOpen(false);
    if (!uid)
      return () => {
        cancelled = true;
      };
    Promise.all([
      getShoes(),
      api.get<FeedActivity[]>(`/activities/user/${uid}?limit=50`),
    ])
      .then(([nextShoes, runs]) => {
        if (!cancelled) {
          setLoadedUid(uid);
          setShoes(nextShoes);
          setActivities(runs);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uid, reload]);

  const putInList = (saved: RunningShoe) =>
    setShoes((prev) => {
      const updated = prev
        .filter((item) => item.id !== saved.id)
        .map((item) =>
          saved.isDefault ? { ...item, isDefault: false } : item,
        );
      return [saved, ...updated];
    });

  const save = async (values: ShoeInput) => {
    if (!uid || busy || assigning) return;
    setBusy(true);
    try {
      const saved = editing
          ? await updateShoe(editing.id, values)
          : await createShoe(values);
      if (scopeRef.current !== uid) return;
      putInList(saved);
      setFormOpen(false);
      toast.success("Tênis salvo.");
    } catch (cause) {
      if (scopeRef.current === uid) toast.error(errorMessage(cause));
    } finally {
      if (scopeRef.current === uid) setBusy(false);
    }
  };

  const makeDefault = async (shoe: RunningShoe) => {
    if (!uid || busy || assigning) return;
    setBusy(true);
    try {
      const saved = await updateShoe(shoe.id, { ...shoeInput(shoe), isDefault: true });
      if (scopeRef.current !== uid) return;
      putInList(saved);
      toast.success("Tênis padrão atualizado.");
    } catch (cause) {
      if (scopeRef.current === uid) toast.error(errorMessage(cause));
    } finally {
      if (scopeRef.current === uid) setBusy(false);
    }
  };

  const assign = async (run: FeedActivity, id: string) => {
    if (!uid || assigning || busy) return;
    setAssigning(run.id);
    try {
      const saved = await assignActivityShoe(run.id, id || null);
      if (scopeRef.current !== uid) return;
      setActivities((prev) =>
        prev.map((item) => (item.id === saved.id ? saved : item)),
      );
      const updated = await getShoes();
      if (scopeRef.current !== uid) return;
      setShoes(updated);
      toast.success("Tênis da corrida atualizado.");
    } catch (cause) {
      if (scopeRef.current === uid) toast.error(errorMessage(cause));
    } finally {
      if (scopeRef.current === uid) setAssigning(null);
    }
  };

  const active = shoes.filter((shoe) => !shoe.retired);
  const visible = showRetired ? shoes : active;
  const alerts = active.filter(
    (shoe) => shoe.status === "attention" || shoe.status === "worn",
  );

  return (
    <main className="min-h-screen bg-background px-4 pb-28 pt-6 text-foreground safe-top sm:px-6">
      <header className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate("/profile")}
          aria-label="Voltar ao perfil"
          className="rounded-xl border border-border p-2"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Equipamentos
          </p>
          <h1 className="font-display text-2xl font-black">Meus tênis</h1>
        </div>
        <button
          disabled={loading || !!error || busy || !!assigning}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-primary px-3 py-2 font-bold text-primary-foreground disabled:opacity-50"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Cadastrar</span>
        </button>
      </header>

      <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
        Acompanhe o uso dos seus tênis e escolha qual usar em cada corrida. Os
        estados são estimativas pela quilometragem e pelo desgaste que você
        informar.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 py-10" role="status">
          <Loader2 className="animate-spin" /> Carregando tênis...
        </div>
      ) : error ? (
        <div className={cn(GLASS_CARD_CLASS, "p-5")} role="alert">
          <p>{error}</p>
          <button
            onClick={() => setReload((n) => n + 1)}
            className="mt-4 flex items-center gap-2 font-bold text-primary"
          >
            <RefreshCw size={16} /> Tentar novamente
          </button>
        </div>
      ) : (
        <>
          {formOpen && (
            <div className="mb-6">
              <ShoeForm
                key={editing?.id ?? "new"}
                shoe={editing}
                firstShoe={active.length === 0}
                busy={busy || !!assigning}
                onSave={save}
                onClose={() => setFormOpen(false)}
              />
            </div>
          )}

          {alerts.length > 0 && (
            <div
              role="status"
              className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm"
            >
              <p className="font-bold">
                {alerts.length} tênis com aviso de uso
              </p>
              <p className="mt-1 text-muted-foreground">
                {alerts.map((shoe) => shoe.name).join(", ")}. Confira o solado e
                o amortecimento e atualize o desgaste percebido.
              </p>
            </div>
          )}

          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-bold">Seus tênis ({visible.length})</h2>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={showRetired}
                onChange={(e) => setShowRetired(e.target.checked)}
              />{" "}
              Mostrar aposentados
            </label>
          </div>

          {visible.length === 0 && (
            <div className={cn(GLASS_CARD_CLASS, "p-8 text-center")}>
              <Footprints className="mx-auto mb-3 text-primary" size={32} />
              <h3 className="font-bold">
                {shoes.length
                  ? "Nenhum tênis ativo"
                  : "Cadastre seu primeiro tênis"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Informe o uso anterior e escolha um limite para começar a
                acompanhar.
              </p>
              <button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                className="mt-4 font-bold text-primary"
              >
                Cadastrar tênis
              </button>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {visible.map((shoe) => (
              <article key={shoe.id} className={cn(GLASS_CARD_CLASS, "p-5")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words text-lg font-black">
                      {shoe.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {[shoe.brand, shoe.model].filter(Boolean).join(" · ") ||
                        "Tênis de corrida"}
                    </p>
                  </div>
                  <button
                    disabled={busy || !!assigning}
                    aria-label={`Editar ${shoe.name}`}
                    onClick={() => {
                      setEditing(shoe);
                      setFormOpen(true);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="rounded-xl p-2 text-primary"
                  >
                    <Pencil size={18} />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ShoeStatusBadge status={shoe.status} />
                  {shoe.isDefault && (
                    <span className="flex items-center gap-1 text-xs font-bold text-primary">
                      <Star size={13} /> Padrão
                    </span>
                  )}
                  {shoe.manuallyWorn && (
                    <span className="text-xs text-muted-foreground">
                      Desgaste informado
                    </span>
                  )}
                </div>
                <p className="mt-5 font-display text-3xl font-black">
                  {km(shoe.totalKm)}{" "}
                  <span className="text-sm text-muted-foreground">
                    / {km(shoe.limitKm)} km
                  </span>
                </p>
                <div
                  role="progressbar"
                  aria-label={`Uso de ${shoe.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(100, shoe.usagePercent)}
                  aria-valuetext={`${km(shoe.usagePercent)}% do limite`}
                  className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"
                >
                  <div
                    style={{ width: `${Math.min(100, shoe.usagePercent)}%` }}
                    className={`h-full rounded-full ${shoe.status === "worn" ? "bg-red-500" : shoe.status === "attention" ? "bg-amber-500" : "bg-primary"}`}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {km(shoe.usagePercent)}% do limite · {km(shoe.remainingKm)} km
                  até o limite
                </p>
                <p className="mt-4 text-xs text-muted-foreground">
                  {shoe.runsCount} corrida(s) vinculada(s) ·{" "}
                  {km(shoe.initialKm)} km de uso anterior
                </p>
                {shoe.purchaseDate && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Compra:{" "}
                    {new Date(
                      `${shoe.purchaseDate}T12:00:00`,
                    ).toLocaleDateString("pt-BR")}
                  </p>
                )}
                {!shoe.retired && !shoe.isDefault && (
                  <button
                    disabled={busy || !!assigning}
                    onClick={() => makeDefault(shoe)}
                    className="mt-4 text-sm font-bold text-primary disabled:opacity-50"
                  >
                    Usar como padrão
                  </button>
                )}
              </article>
            ))}
          </div>

          <p className="my-5 text-xs leading-relaxed text-muted-foreground">
            Bom estado: abaixo de 80% do limite. Atenção: de 80% a menos de
            100%. Gasto: 100% ou desgaste informado. Quilometragem não mede a
            condição física do tênis; observe também seu uso e conservação.
          </p>

          <section className="mt-8" aria-labelledby="shoe-history-title">
            <h2 id="shoe-history-title" className="text-lg font-black">
              Tênis das corridas recentes
            </h2>
            <p className="mb-4 mt-1 text-xs text-muted-foreground">
              Vincule ou corrija o tênis nas últimas 50 corridas. Os totais dos
              tênis incluem todo o histórico vinculado.
            </p>
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Você ainda não tem corridas salvas.
              </p>
            ) : (
              <div className="space-y-3">
                {activities.map((run) => (
                  <div
                    key={run.id}
                    className={cn(
                      GLASS_CARD_CLASS,
                      "flex flex-wrap items-center gap-3 p-4",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">
                        {km(run.distance)} km · {run.time}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {toDateSafe(run.timestamp)?.toLocaleDateString(
                          "pt-BR",
                        ) ?? "Corrida"}
                      </p>
                    </div>
                    <label className="text-xs text-muted-foreground">
                      Tênis desta corrida
                      <select
                        aria-label={`Tênis da corrida ${run.id}`}
                        disabled={!!assigning || busy}
                        value={run.shoeId ?? ""}
                        onChange={(e) => assign(run, e.target.value)}
                        className="mt-1 block w-full max-w-xs rounded-xl border border-input bg-background p-2 text-sm text-foreground"
                      >
                        <option value="">Sem tênis vinculado</option>
                        {shoes
                          .filter(
                            (shoe) => !shoe.retired || shoe.id === run.shoeId,
                          )
                          .map((shoe) => (
                            <option key={shoe.id} value={shoe.id}>
                              {shoe.name}
                              {shoe.retired ? " (aposentado)" : ""}
                            </option>
                          ))}
                      </select>
                    </label>
                    {assigning === run.id && (
                      <Loader2
                        size={16}
                        className="animate-spin"
                        aria-label="Atualizando tênis"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
