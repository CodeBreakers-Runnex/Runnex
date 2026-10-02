import { NavLink, useNavigate } from "react-router-dom";
import { Activity, BarChart3, Bot, CalendarDays, PawPrint, Trophy, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

// Navegação do desktop (lg+). No celular a BottomNav cumpre esse papel;
// esticada numa tela de 1440px ela ficava perdida no rodapé.
const links = [
  { to: "/", icon: Activity, label: "Início", end: true },
  { to: "/dashboard", icon: BarChart3, label: "Estatísticas" },
  { to: "/social", icon: Users, label: "Social" },
  { to: "/events", icon: CalendarDays, label: "Eventos" },
  { to: "/pet", icon: PawPrint, label: "Pet" },
  { to: "/conquistas", icon: Trophy, label: "Conquistas" },
  { to: "/treinador", icon: Bot, label: "Treinador" },
  { to: "/profile", icon: User, label: "Perfil" },
];

export default function SideNav() {
  const navigate = useNavigate();

  return (
    <nav className="fixed inset-y-0 left-0 z-[1000] hidden w-64 flex-col border-r border-border bg-card/80 px-4 py-8 backdrop-blur-xl lg:flex">
      <p className="px-3 font-display text-2xl font-black tracking-tighter text-primary">VELOXY</p>

      <button
        onClick={() => navigate("/run")}
        className="mt-8 flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-xs font-black uppercase tracking-widest text-primary-foreground transition hover:bg-primary/90"
      >
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary-foreground" />
        Iniciar corrida
      </button>

      <ul className="mt-8 space-y-1">
        {links.map(({ to, icon: Icon, label, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
