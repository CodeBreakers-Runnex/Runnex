import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ensureServerAwake } from "./services/serverWake";

// Começa a acordar o backend já na abertura, enquanto a pessoa faz login.
void ensureServerAwake();

createRoot(document.getElementById("root")!).render(<App />);
