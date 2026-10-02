import { Link, useLocation } from "react-router-dom";
import { Compass } from "lucide-react";

const NotFound = () => {
  const { pathname } = useLocation();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center text-foreground">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Compass size={30} />
      </div>
      <p className="mt-6 font-display text-6xl font-black tracking-tighter text-primary">404</p>
      <h1 className="mt-2 font-display text-2xl font-black uppercase tracking-tight">Saiu da rota</h1>
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">
        A página <span className="break-all font-mono text-foreground">{pathname}</span> não existe ou foi removida.
      </p>
      <Link
        to="/"
        className="mt-8 rounded-xl bg-primary px-6 py-3 text-xs font-black uppercase tracking-widest text-primary-foreground transition hover:bg-primary/90"
      >
        Voltar ao início
      </Link>
    </main>
  );
};

export default NotFound;
