import { FirebaseError } from "firebase/app";

export type AuthErrorContext = "login" | "register" | "reset-password" | "auth-action";

function getFirebaseErrorCode(error: unknown): string | undefined {
  if (error instanceof FirebaseError) {
    return error.code;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return undefined;
}

function getErrorMessageText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "";
}

const NOT_ALLOWED_MESSAGE: Record<AuthErrorContext, string> = {
  login: "Este método de login não está ativado no Firebase.",
  register: "O cadastro por email e senha não está ativado no Firebase.",
  "reset-password": "Recuperação de senha não está disponível no momento.",
  "auth-action": "Esta operação não está disponível no momento.",
};

const FALLBACK_MESSAGE: Record<AuthErrorContext, string> = {
  login: "Erro ao fazer login. Tente novamente.",
  register: "Erro ao criar conta. Tente novamente.",
  "reset-password": "Não foi possível enviar o email. Tente novamente.",
  "auth-action": "Não foi possível concluir a operação. Tente novamente.",
};

const FALLBACK_WITH_CODE: Record<AuthErrorContext, (code: string) => string> = {
  login: (code) => `Erro ao fazer login: ${code}`,
  register: (code) => `Erro ao criar conta: ${code}`,
  "reset-password": (code) => `Não foi possível enviar o email. (${code})`,
  "auth-action": (code) => `Não foi possível concluir a operação. (${code})`,
};

// Consolida os mapeamentos de erro do Firebase Auth que antes viviam
// duplicados (com pequenas divergencias de texto) em Login, Register,
// ForgotPasswordModal e AuthAction. `context` decide a mensagem certa
// para os poucos codigos cujo texto muda de tela para tela
// (operation-not-allowed, invalid-email, weak-password) e o fallback
// generico quando o codigo nao e reconhecido.
export function getFirebaseAuthErrorMessage(error: unknown, context: AuthErrorContext): string {
  const code = getFirebaseErrorCode(error);
  const message = getErrorMessageText(error);

  if (context === "login" && message.includes("Google nao retornou credenciais")) {
    return "Google não retornou credenciais. Verifique o SHA-1/SHA-256 e o google-services.json do Android.";
  }

  switch (code) {
    case "auth/popup-closed-by-user":
      return "Login cancelado.";
    case "auth/popup-blocked":
      return "Popup bloqueado. Permita popups para concluir o login com Google.";
    case "auth/unauthorized-domain":
      return "Este domínio não está autorizado no Firebase.";
    case "auth/operation-not-allowed":
      return NOT_ALLOWED_MESSAGE[context];
    case "auth/network-request-failed":
      return "Erro de rede. Verifique sua conexão e tente novamente.";
    case "auth/user-not-found":
      return "Usuário não encontrado.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Email ou senha incorretos.";
    case "auth/invalid-email":
      return context === "login" ? "Email inválido." : "Digite um email válido.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde um pouco e tente novamente.";
    case "auth/email-already-in-use":
      return "Este email já está sendo utilizado.";
    case "auth/weak-password":
      return context === "register"
        ? "A senha deve possuir pelo menos 6 caracteres."
        : "Escolha uma senha com pelo menos 6 caracteres.";
    case "auth/missing-email":
      return "Digite seu email.";
    case "auth/expired-action-code":
      return "Esse link expirou. Peça um novo email.";
    case "auth/invalid-action-code":
      return "Esse link já foi usado ou é inválido. Peça um novo email.";
    case "auth/user-disabled":
      return "Essa conta foi desativada.";
    case "auth/user-mismatch":
      return "Entre com a mesma conta que você quer excluir.";
    case "auth/requires-recent-login":
      return "Por segurança, saia e entre novamente antes de tentar de novo.";
  }

  if (code) {
    return FALLBACK_WITH_CODE[context](code);
  }

  if (message) {
    return context === "login" ? `Erro ao fazer login: ${message}` : FALLBACK_MESSAGE[context];
  }

  return FALLBACK_MESSAGE[context];
}
