export interface SleepSession {
  id: string;
  source: "manual" | "health_connect";
  origin: string;
  originLabel: string;
  externalId: string | null;
  sourceModifiedAt: string | null;
  startTime: string;
  endTime: string;
  wakeDate: string;
  endOffsetMinutes: number | null;
  sleepSeconds: number | null;
  periodSeconds: number;
  kind: "main" | "nap";
}

export interface SleepInput {
  startTime: string;
  endTime: string;
  sleepSeconds: number | null;
  kind: "main" | "nap";
  endOffsetMinutes: number | null;
}

export interface SleepCheckIn {
  date: string;
  quality: number | null;
  fatigue: number | null;
}

export interface RecoveryPreferences {
  goalMinutes: number | null;
  timezone: string;
  preferredOrigin: string | null;
  consented: boolean;
  consentVersion: string | null;
  consentedAt: string | null;
  healthConnectEnabled: boolean;
  syncGeneration: string;
  lastSyncedAt: string | null;
}

export interface SleepDay {
  date: string;
  mainSession: SleepSession | null;
  sleepMinutes: number | null;
  napCount: number;
  checkIn: SleepCheckIn | null;
  status: "attention" | "insufficient" | "no_alerts";
  signals: ("below_goal" | "fatigue" | "missing_sleep")[];
  reasons: string[];
}

export interface RecoveryOverview {
  settings: RecoveryPreferences;
  today: SleepDay;
  history: SleepDay[];
  sessions: SleepSession[];
  origins: string[];
  trend: { validDays: number; requiredDays: number; windowDays: number; averageMinutes: number | null };
  training: { currentKm: number; currentMinutes: number; previousKm: number; previousMinutes: number };
  algorithmVersion: string;
}

export interface SleepImportRecord extends SleepInput {
  externalId: string;
  origin: string;
  originLabel?: string;
  sourceModifiedAt: string;
}

export interface NativeSleepBatch {
  records: SleepImportRecord[];
  deletedIds: string[];
  nextToken: string;
  hasMore: boolean;
  snapshotStart?: string;
  snapshotEnd?: string;
}
