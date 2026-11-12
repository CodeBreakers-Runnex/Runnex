import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Coins, FlaskConical, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { COIN_PACKS, getBonusPercent, type CoinPack } from "@/lib/coins";
import { getCoinPacks, mockPurchaseCoins } from "@/services/coinsApi";

const HIGHLIGHT_LABEL: Record<NonNullable<CoinPack["highlight"]>, string> = {
  popular: "Mais popular",
  "melhor-valor": "Melhor valor",
};

interface CoinShopSheetProps {
  open: boolean;
  userId: string;
  balance: number;
  onClose: () => void;
  /** Novo saldo vindo do backend depois de uma compra. */
  onPurchased: (newBalance: number) => void;
}

export default function CoinShopSheet({ open, userId, balance, onClose, onPurchased }: CoinShopSheetProps) {
  const [mockEnabled, setMockEnabled] = useState<boolean | null>(null);
  const [busyPackId, setBusyPackId] = useState<string | null>(null);
  const [confirmPack, setConfirmPack] = useState<CoinPack | null>(null);

  useEffect(() => {
    if (!open) return;
    setConfirmPack(null);
    getCoinPacks()
      .then((info) => setMockEnabled(info.mockPurchases))
      .catch(() => setMockEnabled(false));
  }, [open]);

  const handleBuy = async (pack: CoinPack) => {
    setBusyPackId(pack.id);
    try {
      const result = await mockPurchaseCoins(userId, pack.id);
      onPurchased(result.petCoins);
      toast.success(`+${result.credited.toLocaleString("pt-BR")} RunCoins adicionadas!`);
      setConfirmPack(null);
    } catch (error) {
      console.error("Erro na compra de RunCoins:", error);
      toast.error("Não foi possível concluir a compra.");
    } finally {
      setBusyPackId(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-label="Comprar RunCoins"
            className="w-full max-w-md rounded-t-[2rem] border-t border-purple-500/30 bg-card px-5 pb-8 pt-4 safe-bottom"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-black uppercase tracking-tighter">RunCoins</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Saldo atual: <span className="font-black text-purple-300">🪙 {balance.toLocaleString("pt-BR")}</span>
                </p>
              </div>
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground"
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Correr continua sendo o jeito principal de ganhar: <b className="text-foreground/80">1 km = 1 RunCoin</b>. Os pacotes
              são um atalho para os itens da loja. Acessórios de conquista não estão à venda.
            </p>

            {mockEnabled && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-300">
                <FlaskConical size={14} className="shrink-0" />
                Modo de teste: nenhuma cobrança é feita.
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              {COIN_PACKS.map((pack) => {
                const bonus = getBonusPercent(pack);
                return (
                  <button
                    key={pack.id}
                    onClick={() => setConfirmPack(pack)}
                    disabled={!mockEnabled || busyPackId !== null}
                    className={`relative flex flex-col items-center gap-1 rounded-2xl border p-4 pt-5 text-center transition active:scale-[0.97] disabled:opacity-50 ${
                      pack.highlight ? "border-purple-500/60 bg-purple-500/10" : "border-border bg-secondary/40"
                    }`}
                  >
                    {pack.highlight && (
                      <span className="absolute -top-2.5 rounded-full bg-purple-600 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
                        {HIGHLIGHT_LABEL[pack.highlight]}
                      </span>
                    )}
                    <Coins size={22} className="text-amber-400" />
                    <span className="text-xl font-black">{pack.coins.toLocaleString("pt-BR")}</span>
                    {bonus > 0 ? (
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">+{bonus}% bônus</span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">RunCoins</span>
                    )}
                    <span className="mt-1 rounded-lg bg-background/60 px-3 py-1 text-xs font-black">{pack.priceLabel}</span>
                  </button>
                );
              })}
            </div>

            {mockEnabled === false && (
              <p className="mt-4 text-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Compras disponíveis em breve
              </p>
            )}

            <AnimatePresence>
              {confirmPack && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="mt-4 rounded-2xl border border-purple-500/40 bg-purple-500/10 p-4"
                >
                  <p className="text-sm">
                    Comprar <b>{confirmPack.coins.toLocaleString("pt-BR")} RunCoins</b> por <b>{confirmPack.priceLabel}</b>?
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setConfirmPack(null)}
                      className="rounded-xl border border-border py-3 text-[11px] font-black uppercase tracking-widest text-muted-foreground"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleBuy(confirmPack)}
                      disabled={busyPackId !== null}
                      className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 text-[11px] font-black uppercase tracking-widest text-white disabled:opacity-60"
                    >
                      {busyPackId ? <Loader2 size={14} className="animate-spin" /> : null}
                      Confirmar
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
