import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import React from "react";
import { Award, Zap, Flame, TrendingUp } from "lucide-react";
import type { FeedActivity } from "@/types";
import type { Timestamp } from "firebase/firestore";

type TimestampLike = Timestamp | Date | string | { seconds: number; nanoseconds?: number };

// Aceita Timestamp do Firestore (coleções ainda não migradas), string ISO
// vinda do backend próprio (Fase 1 em diante) e Date puro.
export const toDateSafe = (timestamp: TimestampLike | null | undefined) => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === "string") {
    const parsed = new Date(timestamp);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if ("toDate" in timestamp && typeof timestamp.toDate === "function") {
    return timestamp.toDate();
  }
  if ("seconds" in timestamp && typeof timestamp.seconds === "number") {
    return new Date(timestamp.seconds * 1000);
  }
  return null;
};

export const getActivityBadge = (distance: number): { label: string, icon: React.ReactNode } => {
  if (distance >= 21) return { label: "MEIA MARATONA!", icon: React.createElement(Award, { size: 10 }) };
  if (distance >= 10) return { label: "10K+ KM!",       icon: React.createElement(Flame, { size: 10 }) };
  if (distance >= 5)  return { label: "5K Atingido",    icon: React.createElement(Zap, { size: 10 }) };
  return              { label: "Em Forma",        icon: React.createElement(TrendingUp, { size: 10 }) };
};

export const initials = (name: string) =>
  name ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "??";

export const formatCardDate = (timestamp: TimestampLike | null | undefined, fallbackMs?: number) => {
  const date = toDateSafe(timestamp) ?? (fallbackMs ? new Date(fallbackMs) : null);
  if (!date) return "Agora mesmo";
  const relative = formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
  const absolute = format(date, "d MMM · HH:mm", { locale: ptBR });
  return `${relative} · ${absolute}`;
};

export const shareActivity = async (item: FeedActivity) => {
  const distanceFixed = Number(item.distance || 0).toFixed(2);
  const text = `🏃 ${item.userName} correu ${distanceFixed}km em ${item.time} com pace ${item.pace}/km! 🔥\n\nVeloxy Running App`;
  try {
    if (navigator.share) {
      await navigator.share({ title: "Veloxy Run", text });
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado para a área de transferência!");
    }
  } catch {
    // cancelled
  }
};
