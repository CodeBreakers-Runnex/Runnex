import { api } from "@/services/apiClient";
import { SLEEP_CONSENT_VERSION } from "@/content/sleepContent";
import type { NativeSleepBatch, RecoveryOverview, RecoveryPreferences, SleepCheckIn, SleepInput, SleepSession } from "@/types/sleep";

export const getRecoveryOverview = (days: number) => api.get<RecoveryOverview>(`/recovery/overview?days=${days}`);
export const acceptSleepConsent = (timezone: string) => api.post<RecoveryPreferences>("/recovery/consent", { accepted: true, version: SLEEP_CONSENT_VERSION, timezone });
export const updateRecoveryPreferences = (input: Pick<RecoveryPreferences, "goalMinutes" | "timezone" | "preferredOrigin">) => api.put<RecoveryPreferences>("/recovery/preferences", input);
export const setSleepConnection = (enabled: boolean) => api.put<RecoveryPreferences>("/recovery/connection", { enabled });
export const createSleepSession = (input: SleepInput) => api.post<SleepSession>("/recovery/sleep", input);
export const updateSleepSession = (id: string, input: SleepInput) => api.put<SleepSession>(`/recovery/sleep/${id}`, input);
export const deleteSleepSession = (id: string) => api.delete<void>(`/recovery/sleep/${id}`);
export const saveSleepCheckIn = (day: string, input: Pick<SleepCheckIn, "quality" | "fatigue">) => api.put<SleepCheckIn>(`/recovery/check-in/${day}`, input);
export const deleteSleepCheckIn = (day: string) => api.delete<void>(`/recovery/check-in/${day}`);
export const deleteRecoveryData = () => api.delete<void>("/recovery/data");
export const getSleepExport = () => api.get<Record<string, unknown>>("/recovery/export");
export const importSleepBatch = (syncGeneration: string, batch: NativeSleepBatch) => {
  const { records, deletedIds, snapshotStart, snapshotEnd } = batch;
  return api.post<{ imported: number }>("/recovery/import", { syncGeneration, records, deletedIds, snapshotStart, snapshotEnd });
};
