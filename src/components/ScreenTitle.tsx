import { cn } from "@/lib/utils";

interface ScreenTitleProps {
  title: string;
  className?: string;
}

// Cabeçalho padrão das telas: "RUNNEX" pequeno em cima e o nome da tela
// grande, roxo e em maiúsculas embaixo.
export default function ScreenTitle({ title, className }: ScreenTitleProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground/70">Runnex</p>
      <h1 className="truncate font-display text-2xl font-black uppercase tracking-tighter text-purple-500">{title}</h1>
    </div>
  );
}
