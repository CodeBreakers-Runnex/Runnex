// Plano VIP: benefícios e, no modo de teste do servidor, ativar/desativar.
// Não há cobrança: ver docs/MONETIZACAO.md.
import { useEffect, useState } from "react";
import { Crown, FlaskConical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getVipInfo, mockActivateVip, mockDeactivateVip } from "@/services/vipApi";

export const VIP_BENEFITS = [
  "Selo VIP no seu perfil",
  "Criar grupos privados, só com código de entrada",
];

export default function VipCard({ userId, isVip, onChange }: {
  userId: string;
  isVip: boolean;
  onChange: (isVip: boolean) => void;
}) {
  const [mockEnabled, setMockEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getVipInfo()
      .then((info) => setMockEnabled(info.mockActivation))
      .catch(() => setMockEnabled(false));
  }, []);

  const toggle = async () => {
    setBusy(true);
    try {
      const result = isVip ? await mockDeactivateVip(userId) : await mockActivateVip(userId);
      onChange(result.isVip);
      toast.success(result.isVip ? "VIP ativado (modo de teste)." : "VIP desativado.");
    } catch (error) {
      console.error("Erro ao alterar o plano VIP:", error);
      toast.error("Não foi possível alterar o plano VIP agora.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="px-6 mt-8 lg:px-0" aria-label="Plano VIP">
      <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-5">
        <div className="flex items-center gap-2">
          <Crown size={20} className="text-amber-400" />
          <p className="font-display text-lg font-black uppercase tracking-tight">Plano VIP</p>
          {isVip && (
            <span className="ml-auto rounded-full bg-amber-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-black">
              Ativo
            </span>
          )}
        </div>
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          {VIP_BENEFITS.map((benefit) => (
            <li key={benefit}>• {benefit}</li>
          ))}
        </ul>

        {mockEnabled ? (
          <>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-300">
              <FlaskConical size={14} className="shrink-0" />
              Modo de teste: nenhuma cobrança é feita.
            </div>
            <button
              onClick={toggle}
              disabled={busy}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 py-3 text-xs font-black uppercase tracking-widest text-amber-300 disabled:opacity-60"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              {isVip ? "Desativar VIP" : "Ativar VIP (teste)"}
            </button>
          </>
        ) : (
          !isVip && (
            <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Ativação disponível em breve
            </p>
          )
        )}
      </div>
    </section>
  );
}
