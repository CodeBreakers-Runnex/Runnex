import { useState } from "react";
import type { FormEvent } from "react";

import { useNavigate } from "react-router-dom";

import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
  Check,
} from "lucide-react";

import { AnimatePresence, motion } from "framer-motion";
import type { Variants } from "framer-motion";

import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";

import { actionCodeSettings, auth } from "@/config/firebase";
import { createUserProfile } from "@/services/database";
import { LEGAL_VERSION } from "@/content/legalContent";
import { getFirebaseAuthErrorMessage } from "@/lib/firebaseAuthErrors";
import { GLASS_CARD_CLASS } from "@/components/GlassCard";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import logo from "@/assets/LogoNova-login.png";

const containerVariants: Variants = {
  hidden: {
    opacity: 0,
  },

  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 18,
  },

  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
    },
  },
};

const USERNAME_REGEX = /^[a-zA-Z0-9]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export default function Register() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [termsAccepted, setTermsAccepted] = useState(false);

  const [loading, setLoading] = useState(false);

  async function handleRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const usernameTrimmed = username.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedConfirmEmail = confirmEmail.trim().toLowerCase();

    if (
      !usernameTrimmed ||
      !normalizedEmail ||
      !normalizedConfirmEmail ||
      !password ||
      !confirmPassword
    ) {
      toast.error("Preencha todos os campos.");
      return;
    }

    if (usernameTrimmed.length < 3) {
      toast.error("O nome de usuário deve ter pelo menos 3 caracteres.");
      return;
    }

    if (!USERNAME_REGEX.test(usernameTrimmed)) {
      toast.error("O nome de usuário deve conter apenas letras e números, sem símbolos.");
      return;
    }

    if (normalizedEmail !== normalizedConfirmEmail) {
      toast.error("Os emails não coincidem.");
      return;
    }

    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (!PASSWORD_REGEX.test(password)) {
      toast.error("A senha deve conter pelo menos uma letra e um número.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    if (!termsAccepted) {
      toast.error("Voce precisa aceitar os Termos de Uso e a Politica de Privacidade para continuar.");
      return;
    }

    try {
      setLoading(true);

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        normalizedEmail,
        password,
      );

      // A partir daqui a conta de autenticação já existe. Se qualquer coisa
      // abaixo falhar, o usuário não pode simplesmente reenviar este
      // formulário (o Firebase recusaria com "email já em uso"), então o
      // restante do fluxo nunca relança erro pra fora: sempre segue para
      // /complete-profile, que sabe criar/completar o documento do usuário
      // sozinho caso este passo não consiga.
      try {
        await updateProfile(userCredential.user, {
          displayName: usernameTrimmed,
        });
      } catch (displayNameError) {
        console.warn("Nao foi possivel definir o nome de exibicao no Auth:", displayNameError);
      }

      // Fase 1.5: sem isso, qualquer um cria conta com email de terceiro
      // sem nunca precisar confirmar que é dono dele. Best-effort: nunca
      // bloqueia o cadastro se o envio do email falhar.
      try {
        await sendEmailVerification(userCredential.user, actionCodeSettings);
      } catch (verificationError) {
        console.warn("Nao foi possivel enviar o email de verificacao:", verificationError);
      }

      let profileCreated = false;
      for (let attempt = 1; attempt <= 3 && !profileCreated; attempt++) {
        try {
          await createUserProfile(userCredential.user.uid, {
            displayName: usernameTrimmed,
            photoURL: userCredential.user.photoURL,
            termsVersion: LEGAL_VERSION,
          });
          profileCreated = true;
        } catch (profileError) {
          console.warn(`Falha ao criar perfil (tentativa ${attempt}/3):`, profileError);
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, attempt * 600));
          }
        }
      }

      if (profileCreated) {
        toast.success(
          `Bem-vindo, ${usernameTrimmed}! Sua conta foi criada com sucesso.`,
        );
      } else {
        toast.warning(
          "Sua conta foi criada, mas não conseguimos salvar seu perfil agora. Vamos tentar novamente na próxima tela.",
          { duration: 8000 },
        );
      }

      // Fase 1.5: manda para a tela de confirmação de email antes do perfil —
      // navegar direto para /complete-profile bypassava o gate do
      // PrivateRoute, já que essa rota é pública.
      navigate("/verificar-email", {
        replace: true,
        state: { from: "register" },
      });
    } catch (error: unknown) {
      console.error("Erro completo ao criar conta:", error);
      toast.error(getFirebaseAuthErrorMessage(error, "register"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100svh] bg-background px-4 py-6 relative overflow-y-auto">
      {/* Fundo animado */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            x: [0, 50, 0],
            y: [0, 30, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-10 left-10 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl"
        />

        <motion.div
          animate={{
            x: [0, -40, 0],
            y: [0, 40, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute bottom-10 right-10 w-80 h-80 bg-pink-500/20 rounded-full blur-3xl"
        />
      </div>

      <div className="relative z-10 min-h-[calc(100svh-3rem)] flex items-center justify-center">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-[440px]"
        >
          <motion.div
            variants={itemVariants}
            className={cn(GLASS_CARD_CLASS, "p-5 sm:p-8 shadow-2xl")}
          >
            {/* Voltar */}
            <motion.button
              variants={itemVariants}
              type="button"
              disabled={loading}
              onClick={() => navigate("/login")}
              whileHover={
                !loading
                  ? {
                    x: -3,
                  }
                  : {}
              }
              whileTap={
                !loading
                  ? {
                    scale: 0.95,
                  }
                  : {}
              }
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-purple-400 transition mb-2 disabled:opacity-60"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para o login
            </motion.button>

            {/* Logo e título */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col items-center mb-6"
            >
              <motion.img
                src={logo}
                alt="Logo Veloxy"
                className="w-24 h-24 sm:w-28 sm:h-28 object-contain mb-2 drop-shadow-2xl"
                whileHover={{
                  scale: 1.06,
                  rotate: [0, -2, 2, 0],
                }}
                transition={{
                  type: "spring",
                  stiffness: 220,
                  damping: 16,
                }}
              />

              <h1 className="text-3xl font-bold text-foreground">
                Crie sua conta
              </h1>

              <p className="text-muted-foreground mt-2 text-sm text-center">
                Comece sua jornada com a Veloxy
              </p>
            </motion.div>

            <form onSubmit={handleRegister} className="space-y-4">
              {/* Nome de usuário */}
              <motion.div variants={itemVariants}>
                <label
                  htmlFor="username"
                  className="text-sm text-foreground/80 mb-2 block font-medium"
                >
                  Nome de usuário
                </label>

                <div className="relative">
                  <User className="absolute left-4 top-3.5 text-muted-foreground w-5 h-5" />

                  <input
                    id="username"
                    type="text"
                    maxLength={30}
                    placeholder="Digite seu nome de usuário"
                    value={username}
                    onChange={(e) =>
                      setUsername(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))
                    }
                    disabled={loading}
                    autoComplete="username"
                    className="w-full bg-secondary border border-input rounded-xl py-3 pl-11 pr-4 text-foreground text-sm outline-none placeholder:text-muted-foreground focus:border-purple-500 transition disabled:opacity-60"
                  />


                  <span className="absolute bottom-2 right-3 text-xs text-muted-foreground">
                    {username.length}/30
                  </span>
                </div>

                <p className="text-xs text-muted-foreground mt-2">
                  Apenas letras e números, sem símbolos.
                </p>
              </motion.div>

              {/* Email */}
              <motion.div variants={itemVariants}>
                <label
                  htmlFor="email"
                  className="text-sm text-foreground/80 mb-2 block font-medium"
                >
                  Email
                </label>

                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 text-muted-foreground w-5 h-5" />
                  <input
                    id="email"
                    type="email"
                    placeholder="Digite seu email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    autoComplete="email"
                    className="w-full bg-secondary border border-input rounded-xl py-3 pl-11 pr-4 text-foreground text-sm outline-none placeholder:text-muted-foreground focus:border-purple-500 transition disabled:opacity-60"
                  />
                </div>
              </motion.div>

              {/* Confirmar email */}
              <motion.div variants={itemVariants}>
                <label
                  htmlFor="confirmEmail"
                  className="text-sm text-foreground/80 mb-2 block font-medium"
                >
                  Confirmar email
                </label>

                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 text-muted-foreground w-5 h-5" />

                  <input
                    id="confirmEmail"
                    type="email"
                    placeholder="Digite seu email novamente"
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    disabled={loading}
                    autoComplete="email"
                    className="w-full bg-secondary border border-input rounded-xl py-3 pl-11 pr-4 text-foreground text-sm outline-none placeholder:text-muted-foreground focus:border-purple-500 transition disabled:opacity-60"
                  />

                </div>
              </motion.div>

              {/* Senha */}
              <motion.div variants={itemVariants}>
                <label
                  htmlFor="password"
                  className="text-sm text-foreground/80 mb-2 block font-medium"
                >
                  Senha
                </label>

                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 text-muted-foreground w-5 h-5" />

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Crie uma senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="new-password"
                    className="w-full bg-secondary border border-input rounded-xl py-3 pl-11 pr-11 text-foreground text-sm outline-none placeholder:text-muted-foreground focus:border-purple-500 transition disabled:opacity-60"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    disabled={loading}
                    aria-label={
                      showPassword ? "Ocultar senha" : "Mostrar senha"
                    }
                    className="absolute right-4 top-3.5 text-muted-foreground hover:text-purple-400 transition disabled:opacity-60"
                  >
                    <AnimatePresence mode="wait">
                      {showPassword ? (
                        <motion.div
                          key="password-eye-off"
                          initial={{
                            opacity: 0,
                            rotate: -90,
                            scale: 0.8,
                          }}
                          animate={{
                            opacity: 1,
                            rotate: 0,
                            scale: 1,
                          }}
                          exit={{
                            opacity: 0,
                            rotate: 90,
                            scale: 0.8,
                          }}
                          transition={{
                            duration: 0.2,
                          }}
                        >
                          <EyeOff className="w-5 h-5" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="password-eye"
                          initial={{
                            opacity: 0,
                            rotate: -90,
                            scale: 0.8,
                          }}
                          animate={{
                            opacity: 1,
                            rotate: 0,
                            scale: 1,
                          }}
                          exit={{
                            opacity: 0,
                            rotate: 90,
                            scale: 0.8,
                          }}
                          transition={{
                            duration: 0.2,
                          }}
                        >
                          <Eye className="w-5 h-5" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                </div>

                <p className="text-xs text-muted-foreground mt-2">
                  Use pelo menos 6 caracteres, com letras e números. Para
                  reforçar a segurança, inclua também símbolos (ex: @, #, !).
                </p>
              </motion.div>

              {/* Confirmar senha */}
              <motion.div variants={itemVariants}>
                <label
                  htmlFor="confirmPassword"
                  className="text-sm text-foreground/80 mb-2 block font-medium"
                >
                  Confirmar senha
                </label>

                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 text-muted-foreground w-5 h-5" />

                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Digite sua senha novamente"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="new-password"
                    className="w-full bg-secondary border border-input rounded-xl py-3 pl-11 pr-11 text-foreground text-sm outline-none placeholder:text-muted-foreground focus:border-purple-500 transition disabled:opacity-60"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword((current) => !current)
                    }
                    disabled={loading}
                    aria-label={
                      showConfirmPassword
                        ? "Ocultar confirmação de senha"
                        : "Mostrar confirmação de senha"
                    }
                    className="absolute right-4 top-3.5 text-muted-foreground hover:text-purple-400 transition disabled:opacity-60"
                  >
                    <AnimatePresence mode="wait">
                      {showConfirmPassword ? (
                        <motion.div
                          key="confirm-eye-off"
                          initial={{
                            opacity: 0,
                            rotate: -90,
                            scale: 0.8,
                          }}
                          animate={{
                            opacity: 1,
                            rotate: 0,
                            scale: 1,
                          }}
                          exit={{
                            opacity: 0,
                            rotate: 90,
                            scale: 0.8,
                          }}
                          transition={{
                            duration: 0.2,
                          }}
                        >
                          <EyeOff className="w-5 h-5" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="confirm-eye"
                          initial={{
                            opacity: 0,
                            rotate: -90,
                            scale: 0.8,
                          }}
                          animate={{
                            opacity: 1,
                            rotate: 0,
                            scale: 1,
                          }}
                          exit={{
                            opacity: 0,
                            rotate: 90,
                            scale: 0.8,
                          }}
                          transition={{
                            duration: 0.2,
                          }}
                        >
                          <Eye className="w-5 h-5" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                </div>
              </motion.div>

              {/* Botão cadastrar */}
              <motion.button
                variants={itemVariants}
                whileHover={
                  !loading
                    ? {
                      scale: 1.02,
                    }
                    : {}
                }
                whileTap={
                  !loading
                    ? {
                      scale: 0.98,
                    }
                    : {}
                }
                disabled={loading}
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-700 transition rounded-xl py-3 text-white text-base font-semibold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  "Criar conta"
                )}
              </motion.button>
            </form>

            {/* Termos */}
            <motion.div
              variants={itemVariants}
              className="flex items-start gap-3 mt-4"
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={termsAccepted}
                aria-label="Aceitar os Termos de Uso e a Política de Privacidade"
                onClick={() => setTermsAccepted((prev) => !prev)}
                disabled={loading}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition disabled:opacity-60 ${
                  termsAccepted ? "bg-purple-600 border-purple-500" : "bg-secondary border-input"
                }`}
              >
                {termsAccepted && <Check size={13} className="text-white" strokeWidth={3} />}
              </button>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Li e concordo com os{" "}
                <button
                  type="button"
                  onClick={() => navigate("/termos-e-privacidade")}
                  className="text-purple-400 hover:text-purple-300 transition">
                  Termos de Uso e Política de Privacidade
                </button>
                .
              </p>
            </motion.div>

            {/* Link para login */}
            <motion.p
              variants={itemVariants}
              className="text-center text-sm text-muted-foreground mt-4"
            >
              Já possui uma conta?{" "}
              <button
                type="button"
                disabled={loading}
                onClick={() => navigate("/login")}
                className="text-purple-400 hover:text-purple-300 font-semibold transition disabled:opacity-60"
              >
                Entrar
              </button>
            </motion.p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}