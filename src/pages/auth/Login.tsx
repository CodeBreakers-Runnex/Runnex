import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";

import {
  signInWithEmailAndPassword,
} from "firebase/auth";


import {
  AnimatePresence,
  motion,
} from "framer-motion";

import type { Variants } from "framer-motion";

import { auth } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { getFirebaseAuthErrorMessage } from "@/lib/firebaseAuthErrors";
import { GLASS_CARD_CLASS } from "@/components/GlassCard";
import { cn } from "@/lib/utils";

import {
  loginComGooglePopup,
} from "@/services/auth";

import ForgotPasswordModal from "@/components/auth/ForgotPasswordModal";

import { toast } from "sonner";

import logo from "@/assets/LogoNova-login.png";

import { FcGoogle } from "react-icons/fc";

/* ================================
   ANIMAÇÕES
================================ */

const containerVariants: Variants = {
  hidden: {
    opacity: 0,
  },

  visible: {
    opacity: 1,

    transition: {
      staggerChildren: 0.08,
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

/* ================================
   ERROS FIREBASE
================================ */

/* ================================
   COMPONENTE
================================ */

export default function Login() {
  const navigate = useNavigate();

  const {
    user,
    loading: authLoading,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const [mostrarSenha, setMostrarSenha] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [
    forgotPasswordOpen,
    setForgotPasswordOpen,
  ] = useState(false);

  /* ================================
     REDIRECIONAMENTO
  ================================ */

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/feed", {
        replace: true,
      });
    }
  }, [
    authLoading,
    user,
    navigate,
  ]);

  /* ================================
     LOGIN EMAIL / SENHA
  ================================ */

  async function handleLogin(
    e: FormEvent<HTMLFormElement>,
  ) {
    e.preventDefault();

    if (!email || !senha) {
      toast.error(
        "Preencha email e senha",
      );

      return;
    }

    try {
      setLoading(true);

      await signInWithEmailAndPassword(
        auth,
        email,
        senha,
      );

      toast.success(
        "Login realizado com sucesso!",
      );

      navigate("/feed", {
        replace: true,
      });
    } catch (error: unknown) {
      console.error(
        "Erro completo no login:",
        error,
      );

      toast.error(
        getFirebaseAuthErrorMessage(error, "login"),
      );
    } finally {
      setLoading(false);
    }
  }

  /* ================================
     LOGIN GOOGLE
  ================================ */

  async function handleGoogleLogin() {
    try {
      setLoading(true);

      await loginComGooglePopup();

      toast.success(
        "Login com Google realizado!",
      );

      navigate("/feed", {
        replace: true,
      });
    } catch (error: unknown) {
      console.error(
        "Erro completo Google:",
        error,
      );

      toast.error(
        getFirebaseAuthErrorMessage(error, "login"),
      );
    } finally {
      setLoading(false);
    }
  }

  /* ================================
     CARREGAMENTO DO AUTH
  ================================ */

  if (authLoading) {
    return (
      <div className="h-[100svh] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />

          <p className="text-muted-foreground text-sm">
            Verificando login...
          </p>
        </div>
      </div>
    );
  }

  /* ================================
     INTERFACE
  ================================ */

  return (
    <div className="h-[100svh] flex items-center justify-center bg-background px-4 py-3 overflow-hidden relative">

      {/* FUNDO */}

      <div className="absolute inset-0 overflow-hidden">

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

      {/* CONTAINER */}

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-[390px]"
      >

        {/* CARD */}

        <motion.div
          variants={itemVariants}
          className={cn(GLASS_CARD_CLASS, "p-5 sm:p-8 shadow-2xl")}
        >

          {/* LOGO */}

          <motion.div
            variants={itemVariants}
            className="flex flex-col items-center mb-5"
          >

            <motion.img
              src={logo}
              alt="Logo Veloxy"
              className="w-24 h-24 sm:w-32 sm:h-32 object-contain mb-3 drop-shadow-2xl"
              whileHover={{
                scale: 1.06,
                rotate: [
                  0,
                  -2,
                  2,
                  0,
                ],
              }}
              transition={{
                type: "spring",
                stiffness: 220,
                damping: 16,
              }}
            />

            <h1 className="text-3xl font-bold text-foreground">
              Bem-vindo
            </h1>

            <p className="text-muted-foreground mt-2 text-sm">
              Faça login para continuar
            </p>

          </motion.div>

          {/* FORM */}

          <form
            onSubmit={handleLogin}
            className="space-y-4"
          >

            {/* EMAIL */}

            <motion.div
              variants={itemVariants}
            >

              <label className="text-sm text-foreground/80 mb-2 block font-medium">
                Email
              </label>

              <div className="relative">

                <Mail className="absolute left-4 top-3.5 text-muted-foreground w-5 h-5" />

                <input
                  type="email"
                  placeholder="Digite seu email"
                  value={email}
                  onChange={(e) =>
                    setEmail(
                      e.target.value,
                    )
                  }
                  disabled={loading}
                  autoComplete="email"
                  className="w-full bg-secondary border border-input rounded-xl py-3 pl-11 pr-4 text-foreground text-sm outline-none focus:border-purple-500 transition disabled:opacity-60"
                />

              </div>

            </motion.div>

            {/* SENHA */}

            <motion.div
              variants={itemVariants}
            >

              <label className="text-sm text-foreground/80 mb-2 block font-medium">
                Senha
              </label>

              <div className="relative">

                <Lock className="absolute left-4 top-3.5 text-muted-foreground w-5 h-5" />

                <input
                  type={
                    mostrarSenha
                      ? "text"
                      : "password"
                  }
                  placeholder="Digite sua senha"
                  value={senha}
                  onChange={(e) =>
                    setSenha(
                      e.target.value,
                    )
                  }
                  disabled={loading}
                  autoComplete="current-password"
                  className="w-full bg-secondary border border-input rounded-xl py-3 pl-11 pr-11 text-foreground text-sm outline-none focus:border-purple-500 transition disabled:opacity-60"
                />

                {/* MOSTRAR / ESCONDER SENHA */}

                <button
                  type="button"
                  onClick={() =>
                    setMostrarSenha(
                      !mostrarSenha,
                    )
                  }
                  disabled={loading}
                  className="absolute right-4 top-3.5 text-muted-foreground hover:text-purple-400 transition disabled:opacity-60"
                  aria-label={
                    mostrarSenha
                      ? "Ocultar senha"
                      : "Mostrar senha"
                  }
                >

                  <AnimatePresence mode="wait">

                    {mostrarSenha ? (
                      <motion.div
                        key="eyeoff"
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
                        key="eye"
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

            {/* ESQUECI MINHA SENHA */}

            <motion.div
              variants={itemVariants}
              className="flex justify-end"
            >

              <button
                type="button"
                onClick={() =>
                  setForgotPasswordOpen(
                    true,
                  )
                }
                disabled={loading}
                className="text-sm text-purple-400 hover:text-purple-300 transition disabled:opacity-60"
              >
                Esqueci minha senha
              </button>

            </motion.div>

            {/* LOGIN */}

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
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}

            </motion.button>

          </form>

          {/* CRIAR CONTA */}

          <motion.p
            variants={itemVariants}
            className="text-center text-sm text-muted-foreground mt-4"
          >

            Não tem uma conta?{" "}

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/register",
                )
              }
              className="text-purple-400 hover:text-purple-300 font-semibold transition"
            >
              Criar conta
            </button>

          </motion.p>

          {/* DIVISOR */}

          <motion.div
            variants={itemVariants}
            className="flex items-center gap-4 my-4"
          >

            <div className="flex-1 h-px bg-border" />

            <span className="text-muted-foreground text-sm">
              ou continue com
            </span>

            <div className="flex-1 h-px bg-border" />

          </motion.div>

          {/* GOOGLE */}

          <motion.div
            variants={itemVariants}
          >

            <motion.button
              whileHover={{
                scale: 1.02,
                y: -2,
              }}
              whileTap={{
                scale: 0.98,
              }}
              onClick={
                handleGoogleLogin
              }
              disabled={loading}
              type="button"
              className="w-full bg-secondary hover:bg-secondary/80 transition rounded-xl py-3 flex items-center justify-center gap-3 text-foreground font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >

              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <FcGoogle className="text-2xl" />

                  Continuar com Google
                </>
              )}

            </motion.button>

          </motion.div>

        </motion.div>

      </motion.div>

      {/* MODAL DE RECUPERAÇÃO DE SENHA */}

      <ForgotPasswordModal
        open={forgotPasswordOpen}
        onClose={() =>
          setForgotPasswordOpen(false)
        }
        initialEmail={email}
      />

    </div>
  );
}