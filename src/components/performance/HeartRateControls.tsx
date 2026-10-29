import { Heart } from "lucide-react";
import { useHeartRateSensor } from "@/hooks/useHeartRateSensor";
export type HeartRateControlProps = { running: boolean; reference?: number; onReading: (bpm: number, reference: number) => void; onBreak: () => void };
// Linha compacta: a tela de corrida precisa caber inteira no celular.
export default function HeartRateControls(props: HeartRateControlProps) {
  const sensor = useHeartRateSensor(props);
  return <section className="mx-4 mt-3 rounded-2xl border border-border bg-card px-3 py-2.5" aria-label="Sensor cardíaco">
    <div className="flex items-center gap-3">
      <Heart size={18} className="shrink-0 text-purple-400" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-tight" aria-live="polite">{sensor.bpm ?? "—"} bpm</p>
        <p className="truncate text-[11px] text-muted-foreground">{sensor.sensorName ?? "Sensor Bluetooth (opcional)"}</p>
      </div>
      <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground" htmlFor="heart-reference" title="FC máxima de referência. Configure antes de iniciar; o GPS não mede batimentos.">
        FC máx
        <input id="heart-reference" aria-label="FC máxima de referência (bpm)" type="number" min="100" max="250" step="1" inputMode="numeric" value={sensor.reference} onChange={event => sensor.setReference(event.target.value)} disabled={props.running || props.reference !== undefined || !!sensor.sensorName || sensor.connecting} className="w-14 rounded-lg border border-border bg-secondary px-1.5 py-1 text-center text-sm text-foreground disabled:opacity-60" />
      </label>
      <button type="button" onClick={() => void (sensor.sensorName || sensor.connecting ? sensor.disconnect() : sensor.connect())} className="shrink-0 rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white">{sensor.connecting ? "Cancelar" : sensor.sensorName ? "Desconectar" : "Conectar"}</button>
    </div>
    {sensor.sensorError && <p role="alert" className="mt-2 text-xs text-red-400">{sensor.sensorError}</p>}
  </section>;
}
