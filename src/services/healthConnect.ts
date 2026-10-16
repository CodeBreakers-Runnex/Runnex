import { Capacitor, registerPlugin } from "@capacitor/core";

/** Android native bridge; available only after the native plugin is built and registered. */
interface HealthConnectBridge {
  availability(): Promise<{ available: boolean; reason?: string }>;
  openPermissions(): Promise<void>;
  permissions(): Promise<{ granted: boolean }>;
  readRuns(options: { since: string }): Promise<{ runs: HealthRun[] }>;
}

export interface HealthRun {
  id: string;
  source: string;
  startedAt: string;
  endedAt: string;
  distanceMeters: number;
}

const bridge = registerPlugin<HealthConnectBridge>("RunnexHealthConnect");

export function isHealthConnectPlatform(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function healthConnectStatus() {
  if (!isHealthConnectPlatform()) return { available: false, reason: "Disponível apenas no aplicativo Android." };
  return bridge.availability();
}

export async function requestHealthConnectAccess() {
  if (!isHealthConnectPlatform()) throw new Error("Abra o aplicativo Android para conectar o Health Connect.");
  // Opens system permissions screen. Caller must recheck permissions on resume.
  await bridge.openPermissions();
}

export async function healthConnectPermissions() {
  if (!isHealthConnectPlatform()) return { granted: false };
  return bridge.permissions();
}

export async function readHealthConnectRuns(since: Date): Promise<HealthRun[]> {
  if (!isHealthConnectPlatform()) throw new Error("Health Connect exige Android.");
  const { runs } = await bridge.readRuns({ since: since.toISOString() });
  return runs.filter(run => run.id && run.source && Number.isFinite(run.distanceMeters) && run.distanceMeters >= 0);
}
