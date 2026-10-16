import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/services/apiClient";
import { healthConnectPermissions, healthConnectStatus, readHealthConnectRuns, requestHealthConnectAccess, type HealthRun } from "@/services/healthConnect";

export default function ConnectedDevices() {
  const [available, setAvailable] = useState(false);
  const [granted, setGranted] = useState(false);
  const [reason, setReason] = useState("");
  const [runs, setRuns] = useState<HealthRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncResult, setSyncResult] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const status = await healthConnectStatus();
      setAvailable(status.available);
      setReason(status.reason ?? "");
      setGranted(status.available && (await healthConnectPermissions()).granted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao verificar Health Connect.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const readRuns = async () => {
    setLoading(true);
    setError("");
    try {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      setRuns(await readHealthConnectRuns(since));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao consultar corridas.");
    } finally {
      setLoading(false);
    }
  };

  const syncRuns = async () => {
    setLoading(true);
    setError("");
    setSyncResult("");
    try {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const data = await readHealthConnectRuns(since);
      setRuns(data);
      // Mesmo minimo do backend (routers/health_imports.py): uma sessao curta nao derruba o lote.
      const eligible = data.filter(run => run.distanceMeters >= 100);
      let created = 0;
      let duplicates = 0;
      for (let index = 0; index < eligible.length; index += 100) {
        const result = await api.post<{ created: number; duplicates: number }>("/health-imports", {
          runs: eligible.slice(index, index + 100).map(run => ({
            external_id: run.id, source: run.source, started_at: run.startedAt,
            ended_at: run.endedAt, distance_meters: run.distanceMeters,
          })),
        });
        created += result.created;
        duplicates += result.duplicates;
      }
      setSyncResult(`${created} corridas importadas; ${duplicates} já existentes.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível sincronizar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl p-6 text-foreground">
      <Link to="/profile" className="text-sm text-purple-400">← Voltar ao perfil</Link>
      <h1 className="mt-6 text-2xl font-bold">Dispositivos conectados</h1>
      <p className="mt-2 text-muted-foreground">Leia corridas de relógios e aplicativos que compartilham dados com o Health Connect.</p>
      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold">Android Health Connect</h2>
        <p className="mt-2 text-sm">{!available ? reason : granted ? "Permissões de exercícios e distância concedidas." : "Autorize exercícios e distância nas configurações do Health Connect."}</p>
        {available && <div className="mt-4 flex flex-wrap gap-3">
          <button className="rounded-xl bg-purple-600 px-4 py-2 text-white" onClick={() => void requestHealthConnectAccess().then(refresh).catch(err => setError(String(err)))}>Abrir permissões</button>
          <button className="rounded-xl border border-border px-4 py-2 disabled:opacity-50" disabled={!granted || loading} onClick={() => void readRuns()}>{loading ? "Lendo..." : "Consultar últimos 30 dias"}</button>
          <button className="rounded-xl bg-purple-600 px-4 py-2 text-white disabled:opacity-50" disabled={!granted || loading} onClick={() => void syncRuns()}>{loading ? "Sincronizando..." : "Importar corridas"}</button>
        </div>}
        {syncResult && <p role="status" className="mt-3 text-sm text-green-500">{syncResult}</p>}
        {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
        <p className="mt-4 text-xs text-muted-foreground">Corridas a partir de 100 m podem ser importadas para o histórico. Importações não geram XP.</p>
        <ul className="mt-4 space-y-2">{runs.map(run => <li className="rounded-lg border border-border p-3 text-sm" key={run.source + run.id}><div>{new Date(run.startedAt).toLocaleString("pt-BR")}</div><div>{(run.distanceMeters / 1000).toFixed(2)} km · {run.source}</div></li>)}</ul>
      </section>
    </main>
  );
}
