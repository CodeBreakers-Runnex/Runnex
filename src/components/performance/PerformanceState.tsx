export default function PerformanceState({ error, retry }: { error: boolean; retry: () => void }) {
  return error ? <section className="mx-6 mt-8 rounded-3xl border border-border bg-card p-6"><p role="alert">Não foi possível carregar sua performance.</p><button onClick={retry} className="mt-3 text-purple-400 underline">Tentar novamente</button></section> : <p role="status" className="px-6 mt-8 text-sm text-muted-foreground">Carregando sua performance…</p>;
}
