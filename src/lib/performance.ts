export function formatDuration(seconds: number) {
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  return `${hours ? `${hours}:` : ""}${String(Math.floor(total / 60) % 60).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
