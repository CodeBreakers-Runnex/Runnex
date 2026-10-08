import { useEffect, useId, useRef, type ReactNode } from "react";

export default function TrainingDialog({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const label = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    return () => { if (dialog.open && typeof dialog.close === "function") dialog.close(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={label} aria-modal="true" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-3xl border border-border bg-card p-6 text-foreground shadow-xl backdrop:bg-black/70">
    <div className="mb-5 flex items-center justify-between gap-4"><h2 id={label} className="text-lg font-black">{title}</h2><button type="button" disabled={busy} onClick={onClose} className="rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-50">Fechar</button></div>
    {children}
  </dialog>;
}
