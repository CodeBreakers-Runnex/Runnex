import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "firebase/auth";
import { Loader2, UserX } from "lucide-react";
import { toast } from "sonner";

import { auth } from "@/config/firebase";
import { getFirebaseAuthErrorMessage } from "@/lib/firebaseAuthErrors";
import { ApiError } from "@/services/apiClient";
import { deleteCurrentAccount, usesPasswordLogin } from "@/services/auth";

const CONFIRMATION_WORD = "EXCLUIR";

const INPUT_CLASS =
  "w-full bg-secondary border border-input rounded-xl px-4 py-3 text-sm outline-none focus:border-red-500 transition";

function getDeleteAccountErrorMessage(error: unknown) {
  if (error instanceof ApiError) return `Não foi possível excluir a conta: ${error.message}`;
  if (typeof error === "object" && error !== null && "code" in error) {
    return getFirebaseAuthErrorMessage(error, "auth-action");
  }
  if (error instanceof Error && error.message) return error.message;
  return "Não foi possível excluir a conta. Tente novamente.";
}

// Exclusao definitiva (LGPD): digitar EXCLUIR + reautenticar (senha ou
// conta Google) antes de qualquer dado ser apagado - ver deleteCurrentAccount.
export default function DeleteAccountSection({ user }: { user: User }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const needsPassword = usesPasswordLogin(user);
  const canSubmit =
    confirmation.trim().toUpperCase() === CONFIRMATION_WORD && (!needsPassword || password.length > 0) && !deleting;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteCurrentAccount(needsPassword ? password : undefined);
      toast.success("Sua conta foi excluída.");
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Erro ao excluir conta:", error);
      toast.error(getDeleteAccountErrorMessage(error), { duration: 8000 });
      if (!auth.currentUser) {
        navigate("/login", { replace: true });
        return;
      }
      setDeleting(false);
    }
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="settings-danger-action w-full rounded-2xl border border-border bg-card/80 backdrop-blur-xl p-4 text-left text-muted-foreground transition"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center">
            <UserX size={18} />
          </div>
          <div>
            <p className="settings-danger-title text-sm font-black">Excluir minha conta</p>
            <p className="settings-muted text-[10px] text-muted-foreground mt-0.5">
              Apaga perfil, corridas, pet, posts e mensagens de forma permanente.
            </p>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-red-500/60 bg-red-500/10 p-4 space-y-3">
      <p className="text-sm font-black text-red-400">Excluir conta definitivamente</p>
      <p className="settings-muted text-xs text-muted-foreground">
        Seu perfil, corridas, XP, pet, posts, comentários, mensagens e inscrições serão apagados e não
        poderão ser recuperados. Grupos que você criou passam para o membro mais antigo.
      </p>

      {needsPassword && (
        <input
          type="password"
          placeholder="Sua senha"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={INPUT_CLASS}
        />
      )}

      <input
        type="text"
        placeholder={`Digite ${CONFIRMATION_WORD} para confirmar`}
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        className={INPUT_CLASS}
      />

      {!needsPassword && (
        <p className="settings-muted text-[10px] text-muted-foreground">
          Você vai precisar confirmar com sua conta Google.
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => {
            setExpanded(false);
            setConfirmation("");
            setPassword("");
          }}
          disabled={deleting}
          className="flex-1 rounded-xl border border-border bg-card/80 py-3 text-xs font-black transition disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          onClick={handleDelete}
          disabled={!canSubmit}
          className="flex-1 rounded-xl bg-red-600 py-3 text-xs font-black text-white transition disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {deleting && <Loader2 size={14} className="animate-spin" />}
          Excluir conta
        </button>
      </div>
    </div>
  );
}
