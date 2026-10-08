import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, Download, Loader2, Lock, Moon, Pencil, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { SLEEP_CONSENT_TEXT } from "@/content/sleepContent";
import SleepEntryForm from "@/components/sleep/SleepEntryForm";
import SleepCheckInForm from "@/components/sleep/SleepCheckInForm";
import { formatSleepDay, formatSleepMinutes, SLEEP_STATUS } from "@/lib/sleep";
import { acceptSleepConsent, createSleepSession, deleteRecoveryData, deleteSleepCheckIn, deleteSleepSession, getRecoveryOverview, getSleepExport, saveSleepCheckIn, setSleepConnection, updateRecoveryPreferences, updateSleepSession } from "@/services/recoveryApi";
import { clearSleepSync, exportSleepData, openSleepHealthSettings, requestSleepPermission, sleepHealthStatus, syncSleep } from "@/services/sleepHealthConnect";
import type { SleepHealthStatus } from "@/services/sleepHealthConnect";
import type { RecoveryOverview, SleepInput, SleepSession } from "@/types/sleep";

const panel = "rounded-3xl border border-border bg-card/80 p-5 shadow-card sm:p-6";
const action = "inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm font-bold transition hover:bg-secondary/70 disabled:opacity-50";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível concluir. Tente novamente.";
}

export default function Sleep() {
  const { user } = useAuth();
  const [days, setDays] = useState(7);
  const [data, setData] = useState<RecoveryOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const busy = saving || syncing;
  const [checked, setChecked] = useState(false);
  const [editor, setEditor] = useState<{ record: SleepSession | null } | null>(null);
  const [goalHours, setGoalHours] = useState("");
  const [preferredOrigin, setPreferredOrigin] = useState("");
  const [health, setHealth] = useState<SleepHealthStatus>({ status: "web", granted: false });
  const [confirmErase, setConfirmErase] = useState(false);
  const requestNumber = useRef(0);
  const autoSyncScope = useRef("");
  const uid = user?.uid;

  const load = useCallback(async () => {
    if (!uid) return;
    const request = ++requestNumber.current;
    setLoading(true);
    try {
      const overview = await getRecoveryOverview(days);
      if (request !== requestNumber.current) return;
      setData(overview);
      setGoalHours(overview.settings.goalMinutes !== null ? String(overview.settings.goalMinutes / 60) : "");
      setPreferredOrigin(overview.settings.preferredOrigin ?? "");
      setError("");
    } catch (err) {
      if (request === requestNumber.current) setError(errorMessage(err));
    } finally {
      if (request === requestNumber.current) setLoading(false);
    }
  }, [uid, days]);

  const refresh = useRef(load);
  useEffect(() => { refresh.current = load; }, [load]);

  useEffect(() => {
    setData(null);
    setEditor(null);
    setConfirmErase(false);
    setChecked(false);
    void load();
    return () => { requestNumber.current += 1; };
  }, [load]);

  useEffect(() => {
    let active = true;
    const update = () => {
      if (document.visibilityState === "hidden") return;
      void sleepHealthStatus().then(status => { if (active) setHealth(status); }).catch(() => { if (active) setHealth({ status: "unavailable", granted: false }); });
    };
    update();
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => { active = false; window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update); };
  }, [uid]);

  async function perform(task: () => Promise<void>) {
    setSaving(true);
    try { await task(); } catch (err) { toast.error(errorMessage(err)); } finally { setSaving(false); }
  }

  const generation = data?.settings.syncGeneration;
  const connected = data?.settings.healthConnectEnabled;
  const consented = data?.settings.consented;
  useEffect(() => {
    if (!uid || !generation || !connected || !consented || health.status !== "available") return;
    const scope = `${uid}:${generation}:${health.granted}`;
    if (autoSyncScope.current === scope) return;
    autoSyncScope.current = scope;
    let active = true;
    setSyncing(true);
    const operation = health.granted ? syncSleep(uid, generation) : setSleepConnection(false);
    void operation.then(() => { if (active) return refresh.current(); }).catch(err => { if (active) toast.error(errorMessage(err)); }).finally(() => { if (active) setSyncing(false); });
    return () => { active = false; setSyncing(false); };
  }, [uid, generation, connected, consented, health.status, health.granted]);

  async function saveRecord(input: SleepInput) {
    await perform(async () => {
      if (editor?.record) await updateSleepSession(editor.record.id, input);
      else await createSleepSession(input);
      setEditor(null);
      await load();
      toast.success("Registro de sono salvo.");
    });
  }

  async function saveGoal(event: FormEvent) {
    event.preventDefault();
    if (!data) return;
    await perform(async () => {
      await updateRecoveryPreferences({ goalMinutes: goalHours.trim() ? Math.round(Number(goalHours) * 60) : null, timezone: data.settings.timezone, preferredOrigin: preferredOrigin || null });
      await load();
      toast.success("Preferências de sono salvas.");
    });
  }

  async function connect() {
    if (!uid || !data) return;
    await perform(async () => {
      const status = await requestSleepPermission();
      setHealth(status);
      if (!status.granted) { toast.info("A leitura de sono não foi autorizada. Você pode usar o registro manual."); return; }
      const settings = await setSleepConnection(true);
      autoSyncScope.current = `${uid}:${settings.syncGeneration}:true`;
      await syncSleep(uid, settings.syncGeneration);
      await load();
      toast.success("Sono sincronizado.");
    });
  }

  async function disconnect() {
    if (!uid || !data) return;
    await perform(async () => {
      await setSleepConnection(false);
      await clearSleepSync(uid, data.settings.syncGeneration);
      await load();
      toast.success("Novas importações interrompidas. Os registros anteriores continuam no histórico.");
    });
  }

  async function erase() {
    if (!uid || !data) return;
    await perform(async () => {
      await deleteRecoveryData();
      // A exclusão no servidor já revogou o consentimento e invalidou lotes pendentes.
      await clearSleepSync(uid, data.settings.syncGeneration).catch(() => undefined);
      setConfirmErase(false);
      setChecked(false);
      await load();
      toast.success("Dados de sono apagados e autorização retirada.");
    });
  }

  const today = data?.today;
  const maxBar = Math.max(60, data?.settings.goalMinutes ?? 0, ...(data?.history.map(d => d.sleepMinutes ?? 0) ?? []));

  return (
    <main className="app-shell pb-28">
      <header className="app-header flex items-center gap-4 px-5 py-5 sm:px-8">
        <Link to="/profile" aria-label="Voltar ao perfil" className="rounded-xl p-2 hover:bg-secondary"><ArrowLeft size={20} /></Link>
        <div className="flex-1"><p className="text-xs font-bold uppercase tracking-widest text-primary">Seu descanso também conta</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">Sono e recuperação</h1></div>
        <span className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground"><Lock size={12} />Privado</span>
      </header>
      <div className="space-y-5 px-5 py-6 sm:px-8">
        {error && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm"><AlertCircle size={18} /><span className="flex-1">{error}</span><button type="button" className={action} onClick={() => void load()}>Tentar novamente</button></div>}
        {loading && !data && <p role="status" className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="animate-spin" size={18} />Carregando seu sono...</p>}

        {data && !data.settings.consented && <section className={panel}>
          <div className="flex items-center gap-3"><ShieldCheck className="text-primary" size={26} /><h2 className="text-xl font-black">Ative seu histórico privado de sono</h2></div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Acompanhe seu descanso e o cansaço junto ao histórico de corridas. Você pode começar sem relógio.</p>
          <label className="mt-5 flex items-start gap-3 text-sm leading-relaxed"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-purple-600" />{SLEEP_CONSENT_TEXT}</label>
          <Link className="mt-4 inline-block text-sm font-bold text-primary underline" to="/termos-e-privacidade">Consultar termos e política de privacidade</Link>
          <button disabled={!checked || busy} className="mt-5 block rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-50" onClick={() => void perform(async () => { await acceptSleepConsent(Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo"); await load(); })}>Ativar controle de sono</button>
        </section>}

        {data?.settings.consented && today && <>
          <section className="hero-card rounded-3xl p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="hero-icon rounded-2xl p-3"><Moon size={24} /></div><div><p className="text-xs text-muted-foreground">Hoje · {formatSleepDay(today.date)}</p><h2 className="mt-1 text-xl font-black">Seu resumo de descanso</h2></div></div><button disabled={busy} className={action} onClick={() => setEditor({ record: null })}><Plus size={16} />Registrar sono</button></div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{today.mainSession?.source === "manual" ? "Sono informado" : "Sono estimado"}</p><p className="mt-2 text-3xl font-black">{formatSleepMinutes(today.sleepMinutes)}</p><p className="mt-1 text-xs text-muted-foreground">{today.mainSession?.originLabel ?? "Registre manualmente ou sincronize"}</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sua meta</p><p className="mt-2 text-3xl font-black">{data.settings.goalMinutes === null ? "Defina abaixo" : formatSleepMinutes(data.settings.goalMinutes)}</p><p className="mt-1 text-xs text-muted-foreground">Escolhida por você</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cansaço informado</p><p className="mt-2 text-3xl font-black">{today.checkIn?.fatigue ? `${today.checkIn.fatigue}/5` : "Sem check-in"}</p><p className="mt-1 text-xs text-muted-foreground">1: muito baixo · 5: muito alto</p></div>
            </div>
            {today.mainSession && today.sleepMinutes === null && <p className="mt-4 text-sm text-muted-foreground">Período registrado: {formatSleepMinutes(today.mainSession.periodSeconds / 60)}. Esse intervalo pode incluir tempo acordado.</p>}
            <div className={`mt-6 rounded-2xl border p-4 ${today.status === "attention" ? "border-amber-400/30 bg-amber-400/10" : "border-border bg-background/30"}`}>
              <p className="flex items-center gap-2 text-sm font-bold"><AlertCircle size={16} />{SLEEP_STATUS[today.status]}</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">{today.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
              <p className="mt-3 text-xs text-muted-foreground">Esses sinais descrevem os dados disponíveis; não garantem aptidão para treinar.</p>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className={panel}><h2 className="mb-4 text-lg font-black">Como você está hoje?</h2><SleepCheckInForm key={`${today.date}:${today.checkIn?.quality}:${today.checkIn?.fatigue}`} value={today.checkIn} busy={busy} onSave={input => perform(async () => { await saveSleepCheckIn(today.date, input); await load(); toast.success("Check-in salvo."); })} />{today.checkIn && <button className="mt-3 text-xs font-bold text-muted-foreground underline" disabled={busy} onClick={() => void perform(async () => { await deleteSleepCheckIn(today.date); await load(); })}>Apagar check-in de hoje</button>}</section>
            <section className={panel}><h2 className="text-lg font-black">Sua meta e fonte de sono</h2><form onSubmit={saveGoal} className="mt-4 space-y-3"><label className="block text-sm font-bold">Meta de sono, em horas<input type="number" min="1" max="16" step="any" placeholder="Escolha sua meta" value={goalHours} onChange={e => setGoalHours(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5" /></label>{data.origins.length > 0 && <label className="block text-sm font-bold">Fonte preferencial<select value={preferredOrigin} onChange={e => setPreferredOrigin(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5"><option value="">Escolher automaticamente</option>{Array.from(new Set([...data.origins, ...(preferredOrigin ? [preferredOrigin] : [])])).map(origin => <option key={origin} value={origin}>{data.sessions.find(s => s.origin === origin)?.originLabel ?? "Fonte anterior"}</option>)}</select></label>}<button disabled={busy} className={action}>Salvar preferências</button></form><p className="mt-3 text-xs text-muted-foreground">Um registro manual tem prioridade. O resumo usa uma sessão principal por dia e não soma cópias de relógios diferentes.</p></section>
          </div>

          <section className={panel}>
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black">Conectar dados de saúde</h2><p className="mt-1 text-sm text-muted-foreground">Importação opcional de sono pelo Health Connect.</p></div><span className="text-xs font-bold text-primary">{data.settings.healthConnectEnabled ? "Conectado" : "Desconectado"}</span></div>
            {health.status === "web" && <p className="mt-4 text-sm text-muted-foreground">A conexão automática está disponível no aplicativo Android atualizado. Aqui, use o registro manual.</p>}
            {health.status === "unavailable" && <p className="mt-4 text-sm text-muted-foreground">Health Connect indisponível neste aparelho. O registro manual continua disponível.</p>}
            {health.status === "update_required" && <div className="mt-4"><p className="text-sm text-muted-foreground">Instale ou atualize o Health Connect para conectar.</p><button disabled={busy} className={`${action} mt-3`} onClick={() => void perform(openSleepHealthSettings)}>Abrir Health Connect</button></div>}
            {health.status === "available" && <div className="mt-4 flex flex-wrap gap-2">{data.settings.healthConnectEnabled && health.granted ? <><button disabled={busy} className={action} onClick={() => void perform(async () => { if (!uid) return; await syncSleep(uid, data.settings.syncGeneration); await load(); toast.success("Sono sincronizado."); })}><RefreshCw size={16} className={busy ? "animate-spin" : ""} />Sincronizar agora</button><button disabled={busy} className={action} onClick={() => void disconnect()}>Desconectar</button></> : <button disabled={busy} className={action} onClick={() => void connect()}>Conectar Health Connect</button>}<button disabled={busy} className={action} onClick={() => void perform(openSleepHealthSettings)}>Gerenciar permissões</button></div>}
            <p className="mt-4 text-xs text-muted-foreground">Última sincronização: {data.settings.lastSyncedAt ? new Date(data.settings.lastSyncedAt).toLocaleString("pt-BR") : "ainda não realizada"}. O relógio ou aplicativo de origem precisa disponibilizar sono no Health Connect.</p>
          </section>

          <section className={panel}>
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-black">Seu histórico de sono</h2><div className="flex gap-2" aria-label="Período do histórico">{[7, 30].map(value => <button key={value} aria-pressed={days === value} className={`${action} ${days === value ? "border-primary text-primary" : ""}`} onClick={() => setDays(value)}>{value} dias</button>)}</div></div>
            <div role="img" aria-label={`Duração de sono nos últimos ${days} dias. Dias sem informação aparecem como lacunas.`} className="mt-6 flex h-32 items-end gap-1.5">{[...data.history].reverse().map(day => <div key={day.date} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${formatSleepDay(day.date)}: ${formatSleepMinutes(day.sleepMinutes)}`}><div className={day.sleepMinutes === null ? "h-1 rounded-full bg-secondary" : "min-h-1 rounded-t-md bg-primary/80"} style={day.sleepMinutes !== null ? { height: `${Math.max(2, day.sleepMinutes / maxBar * 100)}%` } : undefined} /></div>)}</div>
            <p className="mt-4 text-sm text-muted-foreground">{data.trend.averageMinutes === null ? `Conhecendo seu padrão: ${data.trend.validDays} de ${data.trend.requiredDays} dias com duração disponível nos últimos 14 dias.` : `Média dos últimos 14 dias: ${formatSleepMinutes(data.trend.averageMinutes)} (${data.trend.validDays} dias registrados).`}</p>
            <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Sono principal e check-ins por dia</caption><thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="py-3 pr-3">Dia</th><th className="pr-3">Sono</th><th className="pr-3">Qualidade</th><th className="pr-3">Cansaço</th><th>Sinais</th></tr></thead><tbody>{data.history.map(day => <tr key={day.date} className="border-b border-border/60"><td className="py-3 pr-3 whitespace-nowrap">{formatSleepDay(day.date)}</td><td className="pr-3 whitespace-nowrap">{formatSleepMinutes(day.sleepMinutes)}</td><td className="pr-3">{day.checkIn?.quality ? `${day.checkIn.quality}/5` : "—"}</td><td className="pr-3">{day.checkIn?.fatigue ? `${day.checkIn.fatigue}/5` : "—"}</td><td className="min-w-32 text-xs">{SLEEP_STATUS[day.status]}</td></tr>)}</tbody></table></div>
          </section>

          <section className={panel}><h2 className="text-lg font-black">Corridas e descanso</h2><p className="mt-2 text-sm text-muted-foreground">Seu volume de corrida nos últimos 7 dias, para consultar junto ao descanso.</p><div className="mt-4 grid grid-cols-2 gap-4"><div><p className="text-2xl font-black">{data.training.currentKm.toLocaleString("pt-BR")} km</p><p className="mt-1 text-xs text-muted-foreground">7 dias anteriores: {data.training.previousKm.toLocaleString("pt-BR")} km</p></div><div><p className="text-2xl font-black">{Math.round(data.training.currentMinutes)} min</p><p className="mt-1 text-xs text-muted-foreground">7 dias anteriores: {Math.round(data.training.previousMinutes)} min</p></div></div><p className="mt-4 text-xs text-muted-foreground">Descanso não altera seu XP ou suas conquistas.</p></section>

          <section className={panel}><h2 className="text-lg font-black">Seus registros</h2>{data.sessions.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Nenhum sono registrado neste período. Registre seu primeiro sono para começar.</p> : <ul className="mt-4 divide-y divide-border">{data.sessions.map(session => <li key={session.id} className="flex flex-wrap items-center gap-3 py-4"><div className="min-w-0 flex-1"><p className="text-sm font-bold">{formatSleepDay(session.wakeDate)} · {session.kind === "nap" ? "Cochilo" : "Sono principal"}</p><p className="mt-1 text-sm text-muted-foreground">{session.sleepSeconds === null ? `Período registrado: ${formatSleepMinutes(session.periodSeconds / 60)}` : `Sono ${session.source === "manual" ? "informado" : "estimado"}: ${formatSleepMinutes(session.sleepSeconds / 60)}`} · {session.originLabel}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(session.startTime).toLocaleString("pt-BR")} — {new Date(session.endTime).toLocaleString("pt-BR")}</p></div>{session.source === "manual" && <button className={action} disabled={busy} aria-label={`Editar sono ${session.id}`} onClick={() => setEditor({ record: session })}><Pencil size={15} /></button>}<button className={action} disabled={busy} aria-label={`Apagar sono ${session.id}`} onClick={() => { if (window.confirm("Apagar este registro de sono?")) void perform(async () => { await deleteSleepSession(session.id); await load(); }); }}><Trash2 size={15} /></button></li>)}</ul>}</section>

          <section className={panel}><h2 className="text-lg font-black">Você controla seus dados</h2><p className="mt-2 text-sm text-muted-foreground">Seu sono e check-ins são privados, mesmo com perfil público. Exporte os registros ou retire a autorização e apague os dados deste módulo.</p><div className="mt-4 flex flex-wrap gap-3"><button className={action} disabled={busy} onClick={() => void perform(async () => { const exported = await getSleepExport(); if (await exportSleepData(exported)) toast.success("Dados de sono exportados."); })}><Download size={16} />Exportar meus dados</button><button className={`${action} text-red-400`} disabled={busy} onClick={() => setConfirmErase(true)}><Trash2 size={16} />Apagar dados e retirar autorização</button></div>{confirmErase && <div role="alert" className="mt-4 rounded-xl border border-red-400/30 p-4 text-sm"><p>Isso apaga todos os registros de sono e check-ins do Runnex e interrompe novas importações. Os dados no relógio e no Health Connect continuam na origem. Conectar novamente poderá importar os últimos 30 dias.</p><div className="mt-3 flex gap-2"><button disabled={busy} className={`${action} text-red-400`} onClick={() => void erase()}>Confirmar exclusão dos dados de sono</button><button disabled={busy} className={action} onClick={() => setConfirmErase(false)}>Cancelar</button></div></div>}</section>
        </>}
      </div>
      {editor && <SleepEntryForm key={editor.record?.id ?? "new"} record={editor.record} busy={busy} onSave={saveRecord} onClose={() => setEditor(null)} />}
    </main>
  );
}
