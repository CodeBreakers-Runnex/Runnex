import { motion } from "framer-motion";
import { ReactNode } from "react";
import { GLASS_CARD_CLASS } from "@/components/GlassCard";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  unit?: string;
  color?: "lime" | "blue" | "orange" | "purple" | "red";
}

const colorMap = {
  lime: "text-primary",
  blue: "text-stat-blue",
  orange: "text-stat-orange",
  purple: "text-stat-purple",
  red: "text-stat-red",
};

const StatCard = ({ icon, label, value, unit, color = "lime" }: StatCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(GLASS_CARD_CLASS, "rounded-2xl p-4")}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={colorMap[color]}>{icon}</span>
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-display font-bold ${colorMap[color]}`}>
          {value}
        </span>
        {unit && (
          <span className="text-sm text-muted-foreground">{unit}</span>
        )}
      </div>
    </motion.div>
  );
};

export default StatCard;
