import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { buildUserDataExport, saveUserDataExport } from "@/services/dataExport";

// LGPD (acesso e portabilidade): baixa tudo que o Runnex guarda do usuário
// num arquivo JSON. No Android abre o menu de compartilhar para salvar.
export default function ExportDataButton() {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await buildUserDataExport();
      const result = await saveUserDataExport(data);
      toast.success(result === "shared" ? "Arquivo pronto. Escolha onde salvar." : "Arquivo com seus dados baixado.");
    } catch (error) {
      console.error("Erro ao exportar dados:", error);
      toast.error("Não foi possível exportar seus dados agora. Tente novamente.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={exporting}
      className="w-full rounded-2xl border border-border bg-card p-4 text-left text-muted-foreground transition disabled:opacity-60"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
        </div>
        <div>
          <p className="text-sm font-black text-foreground">{exporting ? "Preparando arquivo..." : "Baixar meus dados"}</p>
          <p className="settings-muted mt-0.5 text-[10px] text-muted-foreground">
            Perfil, corridas, tênis, sono, treinos, grupos e mensagens em um arquivo JSON.
          </p>
        </div>
      </div>
    </button>
  );
}
