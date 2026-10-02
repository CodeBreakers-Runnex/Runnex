import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, ShieldCheck } from "lucide-react";

import { motion } from "framer-motion";

import logo from "@/assets/LogoNova-login.png";
import { legalContent } from "@/content/legalContent";
import { GLASS_CARD_CLASS } from "@/components/GlassCard";
import { cn } from "@/lib/utils";

export default function Legal() {
    const navigate = useNavigate();

    return (
        <div className="min-h-[100svh] bg-background text-foreground relative overflow-hidden">
            {/* FUNDO ANIMADO */}
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

            {/* CONTEÚDO */}
            <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-6 sm:py-10">
                {/* VOLTAR */}
                <motion.button
                    type="button"
                    onClick={() => navigate(-1)}
                    whileHover={{
                        x: -3,
                    }}
                    whileTap={{
                        scale: 0.95,
                    }}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-purple-400 transition mb-5"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar
                </motion.button>

                {/* CARD */}
                <motion.div
                    initial={{
                        opacity: 0,
                        y: 20,
                    }}
                    animate={{
                        opacity: 1,
                        y: 0,
                    }}
                    transition={{
                        duration: 0.4,
                    }}
                    className={cn(GLASS_CARD_CLASS, "shadow-2xl overflow-hidden")}
                >
                    {/* HEADER */}
                    <div className="px-5 sm:px-8 pt-7 pb-6 border-b border-border">
                        <div className="flex flex-col items-center text-center">
                            <motion.img
                                src={logo}
                                alt="Logo Runnex"
                                className="w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-2xl"
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

                            <div className="flex items-center justify-center gap-2 mt-3">
                                <FileText className="w-6 h-6 text-purple-400" />

                                <h1 className="text-2xl sm:text-3xl font-bold">
                                    Termos de Uso e Política de Privacidade
                                </h1>
                            </div>

                            <div className="flex items-center gap-2 mt-3 text-muted-foreground">
                                <ShieldCheck className="w-4 h-4 text-purple-400" />

                                <p className="text-sm">
                                    Leia atentamente antes de utilizar o aplicativo
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* TEXTO */}
                    <div className="px-5 sm:px-8 py-7 sm:py-10">
                        <div className="whitespace-pre-line text-sm sm:text-[15px] text-foreground/80 leading-7">
                            {legalContent}
                        </div>
                    </div>

                    <motion.button
                        type="button"
                        onClick={() =>
                            window.scrollTo({
                                top: 0,
                                behavior: "smooth",
                            })
                        }
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="mt-6 w-full bg-purple-600 hover:bg-purple-700 transition rounded-xl py-3 text-white font-semibold"
                    >
                        Voltar ao topo
                    </motion.button>


                </motion.div>

                {/* FOOTER */}
                <p className="text-center text-xs text-muted-foreground/70 mt-5 pb-4">
                    © 2026 RUNNEX. Todos os direitos reservados.
                </p>
            </div>
        </div>
    );
}