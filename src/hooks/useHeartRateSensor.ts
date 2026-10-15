import { useEffect, useRef, useState } from "react";
import { connectHeartRate } from "@/services/heartRateSensor";

type Options = { reference?: number; onReading: (bpm: number, reference: number) => void; onBreak: () => void };
export function useHeartRateSensor(options: Options) {
  const [bpm, setBpm] = useState<number | null>(null);
  const [sensorName, setSensorName] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [input, setReference] = useState("");
  const [sensorError, setSensorError] = useState("");
  const reference = options.reference === undefined ? input : String(options.reference);
  const referenceNumber = Number(reference);
  const validReference = Number.isInteger(referenceNumber) && referenceNumber >= 100 && referenceNumber <= 250;
  const callbacks = useRef(options);
  callbacks.current = options;
  const lifecycle = useRef({ alive: true, version: 0, busy: false, readAt: 0 });
  const sensorRef = useRef<Awaited<ReturnType<typeof connectHeartRate>> | null>(null);
  useEffect(() => {
    const state = lifecycle.current;
    state.alive = true;
    return () => {
      state.alive = false;
      state.version++;
      state.busy = false;
      const sensor = sensorRef.current;
      sensorRef.current = null;
      void sensor?.disconnect().catch(() => undefined);
    };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      const state = lifecycle.current;
      if (state.readAt && Date.now() - state.readAt > 10000) {
        state.readAt = 0;
        setBpm(null);
        callbacks.current.onBreak();
      }
    }, 2000);
    return () => clearInterval(timer);
  }, []);
  const connect = async () => {
    const state = lifecycle.current;
    if (state.busy || sensorRef.current) return;
    if (!validReference) { setSensorError("Informe sua FC máxima de referência (100–250 bpm)."); return; }
    state.busy = true;
    const version = ++state.version;
    const isCurrent = () => state.alive && state.version === version;
    callbacks.current.onBreak();
    setConnecting(true); setSensorError("");
    try {
      const sensor = await connectHeartRate(value => {
        if (!isCurrent()) return;
        state.readAt = Date.now(); setBpm(value);
        callbacks.current.onReading(value, referenceNumber);
      }, () => {
        if (!isCurrent()) return;
        state.version++; state.busy = false; state.readAt = 0;
        callbacks.current.onBreak();
        sensorRef.current = null;
        setConnecting(false); setSensorName(""); setBpm(null);
      }, () => {
        if (!isCurrent()) return;
        state.readAt = 0;
        setBpm(null); callbacks.current.onBreak();
      });
      if (!isCurrent()) { await sensor.disconnect().catch(() => undefined); return; }
      sensorRef.current = sensor; setSensorName(sensor.name);
    } catch {
      if (isCurrent()) {
        state.version++; state.busy = false; state.readAt = 0;
        callbacks.current.onBreak();
        setConnecting(false); setBpm(null);
        setSensorError("Não foi possível conectar. Use um sensor BLE de frequência cardíaca e habilite Bluetooth/permissões.");
      }
    } finally {
      if (isCurrent()) { state.busy = false; setConnecting(false); }
    }
  };
  const disconnect = async () => {
    const state = lifecycle.current;
    state.version++; state.busy = false; state.readAt = 0;
    callbacks.current.onBreak();
    const sensor = sensorRef.current;
    sensorRef.current = null;
    setConnecting(false); setSensorName(""); setBpm(null);
    try { await sensor?.disconnect(); }
    catch { if (state.alive) setSensorError("O sensor perdeu a conexão. Tente conectar novamente."); }
  };
  return { bpm, sensorName, connecting, reference, setReference, sensorError, connect, disconnect, validReference };
}
