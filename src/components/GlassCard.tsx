import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Classe do cartao padrao, repetida dezenas de vezes pelas telas. Exportada
// tambem como string porque parte desses cards e' <motion.div> (framer-motion),
// que o componente <GlassCard> abaixo (um <div> comum) nao cobre.
// O nome ficou da epoca do efeito de vidro: o cartao agora e' solido. O
// desfoque (backdrop-blur) e' caro no WebView do Android e sobre fundo liso
// nao aparece; fica so nos fundos de modal e nos paineis sobre o mapa.
export const GLASS_CARD_CLASS = "rounded-3xl border border-border bg-card";

type GlassCardProps = HTMLAttributes<HTMLDivElement>;

// Cobre so os blocos de conteudo de verdade (cards de estatistica, paineis de
// modal, etc.) sem animacao - cabecalhos fixos, botoes redondos e linhas de
// lista clicaveis continuam com sua propria classe, sao elementos diferentes
// que so compartilham o mesmo fundo visual.
export function GlassCard({ className, ...props }: GlassCardProps) {
  return <div className={cn(GLASS_CARD_CLASS, className)} {...props} />;
}
