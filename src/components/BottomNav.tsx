import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { 
  Activity, 
  Users, 
  CalendarDays,
  User,
  Plus
} from "lucide-react";
import { motion } from "framer-motion";

const tabs = [
  { path: "/", icon: Activity, label: "INICIO" },
  { path: "/social", icon: Users, label: "SOCIAL" },
  { path: "RECORD", icon: Plus, label: "" }, // Botão central especial
  { path: "/events", icon: CalendarDays, label: "EVENTOS" },
  { path: "/profile", icon: User, label: "PROFILE" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Hide on run tracking page
  if (location.pathname === "/run") return null;

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-[1000] bg-card/80 backdrop-blur-xl border-t border-border safe-bottom">
      <div className="flex items-center justify-around px-2 pt-3 pb-2 max-w-lg mx-auto relative">
        {tabs.map((tab, idx) => {
          if (tab.path === "RECORD") {
            return (
              <div key={idx} className="relative -top-6">
                <motion.button
                  initial={{ y: 12, opacity: 0, scale: 0.9 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.1, rotate: -4 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => navigate("/run")}
                  className="bg-purple-600 w-14 h-14 rounded-full flex items-center justify-center border-4 border-background"
                  aria-label="Iniciar corrida"
                >
                  <div className="w-4 h-4 rounded-full bg-white/95 shadow-[0_0_10px_rgba(255,255,255,0.7)] animate-pulse" />
                </motion.button>
              </div>
            );
          }

          const isActive =
            location.pathname === tab.path ||
            (tab.path === "/" && location.pathname === "/home") ||
            (tab.path === "/social" && location.pathname === "/feed");
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className="flex flex-col items-center gap-1 px-4 py-1 relative group pressable-premium"
            >
              <motion.div
                animate={isActive ? { y: -2, scale: 1.08 } : { y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 24 }}
              >
                <tab.icon
                  size={22}
                  className={isActive ? "text-purple-500" : "text-muted-foreground group-hover:text-foreground/80 transition-colors"}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </motion.div>
              <span
                className={`text-[9px] font-black tracking-tighter ${
                  isActive ? "text-purple-500" : "text-muted-foreground group-hover:text-foreground/80"
                }`}
              >
                {tab.label}
              </span>
              
              {isActive && (
                <motion.div
                  layoutId="activeTabGlow"
                  className="absolute -bottom-1 h-1 w-4 rounded-full bg-purple-500/90"
                />
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
