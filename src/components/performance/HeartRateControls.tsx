import { Heart } from "lucide-react";
import { useHeartRateSensor } from "@/hooks/useHeartRateSensor";
export type HeartRateControlProps = { running: boolean; reference?: number; onReading: (bpm: number, reference: number) => void; onBreak: () => void };
export default function HeartRateControls(props: HeartRateControlProps) {
  const sensor = useHeartRateSensor(props);
  return <section className="mx-6 mt-5 rounded-2xl border border-border bg-card p-4" aria-label="Sensor cardíaco">
    <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-bold"><Heart size={18} className="text-purple-400" />Sensor cardíaco</h2><p className="font-bold" aria-live="polite">{sensor.bpm ?? "—"} bpm</p></div>
    <label className="mt-3 block text-xs text-muted-foreground" htmlFor="heart-reference">FC máxima de referência (bpm)</label>
    <input id="heart-reference" type="number" min="100" max="250" step="1" inputMode="numeric" value={sensor.reference} onChange={event => sensor.setReference(event.target.value)} disabled={props.running || props.reference !== undefined || !!sensor.sensorName || sensor.connecting} className="mt-1 w-full rounded-xl border border-border bg-secondary p-2 text-sm disabled:opacity-60" />
    <p className="mt-2 text-xs text-muted-foreground">Configure sua referência antes de iniciar. Requer sensor Bluetooth compatível; o GPS não mede batimentos.</p>
    {sensor.sensorName && <p className="mt-2 text-sm">{sensor.sensorName}</p>}
    <button type="button" onClick={() => void (sensor.sensorName || sensor.connecting ? sensor.disconnect() : sensor.connect())} className="mt-3 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white">{sensor.connecting ? "Cancelar conexão" : sensor.sensorName ? "Desconectar sensor" : "Conectar sensor"}</button>
    {sensor.sensorError && <p role="alert" className="mt-2 text-xs text-red-400">{sensor.sensorError}</p>}
  </section>;
}
