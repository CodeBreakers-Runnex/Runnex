import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Classe do cartao "vidro" (fundo translucido + blur + borda) repetida
// dezenas de vezes pelas telas com a mesma string Tailwind. Exportada tambem
// como string porque parte desses cards e' <motion.div> (framer-motion), que
// o componente <GlassCard> abaixo (um <div> comum) nao cobre.
export const GLASS_CARD_CLASS = "rounded-3xl border border-border bg-card/80 backdrop-blur-xl";

type GlassCardProps = HTMLAttributes<HTMLDivElement>;

// Cobre so os blocos de conteudo de verdade (cards de estatistica, paineis de
// modal, etc.) sem animacao - cabecalhos fixos, botoes redondos e linhas de
// lista clicaveis continuam com sua propria classe, sao elementos diferentes
// que so compartilham o mesmo fundo visual.
export function GlassCard({ className, ...props }: GlassCardProps) {
  return <div className={cn(GLASS_CARD_CLASS, className)} {...props} />;
}
