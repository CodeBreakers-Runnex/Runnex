export type DistanceUnit = "km" | "mi";

export type SettingsState = {
  privateProfile: boolean;
  units: DistanceUnit;
};

const SETTINGS_STORAGE_KEY = "veloxy-settings";

export const defaultSettings: SettingsState = {
  privateProfile: false,
  units: "km",
};

// Unico dono da chave "veloxy-settings" no localStorage — antes Home.tsx e
// Profile.tsx liam/escreviam essa chave cada um com sua propria logica de
// merge/try-catch, o que arriscava as duas telas divergirem sobre o formato.
export function getStoredSettings(): SettingsState {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export function updateStoredSettings<K extends keyof SettingsState>(
  key: K,
  value: SettingsState[K],
): SettingsState {
  const next = { ...getStoredSettings(), [key]: value };

  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage indisponivel: a preferencia so vale para esta sessao
  }

  return next;
}
