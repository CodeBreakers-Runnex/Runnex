import { Suspense, lazy, useEffect } from "react";

import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import {
  BrowserRouter,
  Routes,
  Route,
  Outlet,
  useLocation,
} from "react-router-dom";

import BottomNav from "@/components/BottomNav";
import SideNav from "@/components/SideNav";
import TermsGate from "@/components/TermsGate";
import PrivateRoute from "@/components/PrivateRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/hooks/AuthContext";

/* =========================
   PÁGINAS DE AUTENTICAÇÃO
========================= */

const Login = lazy(() => import("@/pages/auth/Login"));
const Register = lazy(() => import("@/pages/auth/Register"));
const CompleteProfile = lazy(
  () => import("@/pages/auth/CompleteProfile"),
);
const VerifyEmail = lazy(() => import("@/pages/auth/VerifyEmail"));
const AuthAction = lazy(() => import("@/pages/auth/AuthAction"));

/* NOVA PÁGINA */
const Legal = lazy(() => import("@/pages/auth/Legal"));

/* =========================
   PÁGINAS DO APP
========================= */

const Home = lazy(() => import("@/pages/app/Home"));
const Social = lazy(() => import("@/pages/app/Social"));
const Dashboard = lazy(() => import("@/pages/app/Dashboard"));
const RunTracking = lazy(() => import("@/pages/app/RunTracking"));
const Events = lazy(() => import("@/pages/app/Events"));
const Profile = lazy(() => import("@/pages/app/Profile"));
const Group = lazy(() => import("@/pages/app/Group"));
const Pet = lazy(() => import("@/pages/app/Pet"));
const Achievements = lazy(() => import("@/pages/app/Achievements"));
const Coach = lazy(() => import("@/pages/app/Coach"));

const NotFound = lazy(() => import("@/pages/NotFound"));

function applySavedTheme() {
  const theme =
    localStorage.getItem("veloxy-theme") === "light"
      ? "light"
      : "dark";

  document.documentElement.classList.toggle(
    "light",
    theme === "light",
  );

  document.documentElement.classList.toggle(
    "dark",
    theme === "dark",
  );
}

function ProtectedLayout() {
  // A tela de corrida é um mapa em tela cheia: sem menu lateral nem coluna.
  const isRunScreen = useLocation().pathname === "/run";

  return (
    <PrivateRoute>
      <div className={isRunScreen ? "min-h-screen" : "min-h-screen lg:pl-64"}>
        <div className={isRunScreen ? undefined : "lg:mx-auto lg:max-w-6xl"}>
          <Outlet />
        </div>
        {!isRunScreen && <SideNav />}
        <BottomNav />
        <TermsGate />
      </div>
    </PrivateRoute>
  );
}

function AppLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
      Carregando...
    </div>
  );
}

const App = () => {
  useEffect(() => {
    applySavedTheme();
  }, []);

  return (
    <ErrorBoundary>
      <TooltipProvider>
        <Sonner />

        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<AppLoading />}>
              <Routes>
                {/* =========================
                    ROTAS PÚBLICAS
                ========================= */}

                <Route
                  path="/login"
                  element={<Login />}
                />

                <Route
                  path="/register"
                  element={<Register />}
                />

                <Route
                  path="/complete-profile"
                  element={<CompleteProfile />}
                />

                <Route
                  path="/verificar-email"
                  element={<VerifyEmail />}
                />

                <Route
                  path="/auth/action"
                  element={<AuthAction />}
                />

                {/* TERMOS E PRIVACIDADE */}
                <Route
                  path="/termos-e-privacidade"
                  element={<Legal />}
                />

                {/* =========================
                    ROTAS PROTEGIDAS
                ========================= */}

                <Route element={<ProtectedLayout />}>
                  <Route
                    index
                    element={<Home />}
                  />

                  <Route
                    path="home"
                    element={<Home />}
                  />

                  <Route
                    path="feed"
                    element={<Social />}
                  />

                  <Route
                    path="social"
                    element={<Social />}
                  />

                  <Route
                    path="dashboard"
                    element={<Dashboard />}
                  />

                  <Route
                    path="stats"
                    element={<Dashboard />}
                  />

                  <Route
                    path="run"
                    element={<RunTracking />}
                  />

                  <Route
                    path="events"
                    element={<Events />}
                  />

                  <Route
                    path="profile"
                    element={<Profile />}
                  />

                  <Route
                    path="grupo/:groupId"
                    element={<Group />}
                  />

                  <Route
                    path="pet"
                    element={<Pet />}
                  />

                  <Route
                    path="conquistas"
                    element={<Achievements />}
                  />

                  <Route
                    path="treinador"
                    element={<Coach />}
                  />
                </Route>

                {/* =========================
                    404
                ========================= */}

                <Route
                  path="*"
                  element={<NotFound />}
                />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ErrorBoundary>
  );
};

export default App;