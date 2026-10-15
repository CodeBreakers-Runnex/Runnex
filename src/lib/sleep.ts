export const SLEEP_STATUS = {
  attention: "Sinais de atenção",
  insufficient: "Dados insuficientes",
  no_alerts: "Sem alertas nos dados disponíveis",
} as const;

export function formatSleepMinutes(minutes: number | null): string {
  if (minutes === null) return "Sem registro";
  const rounded = Math.round(minutes);
  return `${Math.floor(rounded / 60)}h${String(rounded % 60).padStart(2, "0")}`;
}

export function localDateTimeValue(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function formatSleepDay(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
