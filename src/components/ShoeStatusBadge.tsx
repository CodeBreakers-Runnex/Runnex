import type { ShoeStatus } from "@/types";

const states: Record<ShoeStatus, { label: string; style: string }> = {
  good: { label: "Em bom estado", style: "bg-emerald-500/10 text-emerald-500" },
  attention: { label: "Atenção", style: "bg-amber-500/10 text-amber-500" },
  worn: { label: "Gasto", style: "bg-red-500/10 text-red-500" },
  retired: { label: "Aposentado", style: "bg-secondary text-muted-foreground" },
};

export default function ShoeStatusBadge({ status }: { status: ShoeStatus }) {
  const state = states[status];
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${state.style}`}
    >
      {state.label}
    </span>
  );
}
