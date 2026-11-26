// Seletor de tênis da tela de corrida (antes dentro de RunTracking.tsx).
import ShoeStatusBadge from "@/components/ShoeStatusBadge";
import type { RunningShoe } from "@/types";

export default function ShoePicker({
  shoes,
  selectedShoeId,
  selectedShoe,
  loadingShoes,
  shoeLoadError,
  isSaving,
  isRunning,
  isPaused,
  onSelect,
  onOpenShoes,
}: {
  shoes: RunningShoe[];
  selectedShoeId: string | null;
  selectedShoe: RunningShoe | undefined;
  loadingShoes: boolean;
  shoeLoadError: boolean;
  isSaving: boolean;
  isRunning: boolean;
  isPaused: boolean;
  onSelect: (shoeId: string | null) => void;
  onOpenShoes: () => void;
}) {
  return (
    <section className="mx-4 mt-2 rounded-2xl border border-border bg-card px-3 py-2.5" aria-label="Tênis da corrida">
      <div className="flex items-center gap-2">
        <label htmlFor="run-shoe" className="shrink-0 text-xs font-bold">Tênis</label>
      <select id="run-shoe" value={selectedShoeId ?? ""} disabled={loadingShoes || isSaving || (isRunning && !isPaused)} onChange={(e) => onSelect(e.target.value || null)} className="min-w-0 flex-1 rounded-xl border border-input bg-background px-2 py-1.5 text-sm disabled:opacity-60">
        <option value="">{loadingShoes ? "Carregando tênis..." : "Sem tênis vinculado"}</option>
        {shoes.filter((shoe) => !shoe.retired || shoe.id === selectedShoeId).map((shoe) => <option key={shoe.id} value={shoe.id} disabled={shoe.retired}>{shoe.name}{shoe.isDefault ? " (padrão)" : ""}{shoe.retired ? " (aposentado)" : ""}</option>)}
        {selectedShoeId && !selectedShoe && <option value={selectedShoeId}>Tênis salvo com o treino</option>}
      </select>
        {selectedShoe && <span className="shrink-0 text-[11px] text-muted-foreground">{selectedShoe.totalKm.toLocaleString("pt-BR")}/{selectedShoe.limitKm.toLocaleString("pt-BR")} km</span>}
        {!isRunning && <button type="button" onClick={onOpenShoes} className="shrink-0 text-xs font-bold text-primary">Meus tênis</button>}
      </div>
      {shoeLoadError && <p className="mt-2 text-xs text-amber-500">Não foi possível carregar os tênis. Você pode continuar sem vínculo e associá-lo depois em Meus tênis.</p>}
      {selectedShoe && selectedShoe.status !== "good" && <div className="mt-2"><ShoeStatusBadge status={selectedShoe.status} /></div>}
      {selectedShoe && (selectedShoe.status === "attention" || selectedShoe.status === "worn" || selectedShoe.retired) && <p className="mt-2 text-xs text-amber-500">{selectedShoe.retired ? "Tênis aposentado. Pause e escolha outro tênis para salvar a corrida." : "Confira o desgaste deste tênis antes do treino."}</p>}
      {isRunning && <p className="mt-2 text-xs text-muted-foreground">Pause a corrida para corrigir o tênis escolhido.</p>}
    </section>
  );
}
