import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  auth: { loading: false, user: null as null | { uid: string } },
  signIn: vi.fn(),
  google: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/config/firebase", () => ({ auth: { name: "auth-de-teste" } }));
vi.mock("firebase/auth", () => ({ signInWithEmailAndPassword: (...args: unknown[]) => mocks.signIn(...args) }));
vi.mock("@/services/auth", () => ({ loginComGooglePopup: () => mocks.google() }));
vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => mocks.success(...a), error: (...a: unknown[]) => mocks.error(...a) } }));
vi.mock("@/components/auth/ForgotPasswordModal", () => ({ default: () => null }));

import Login from "@/pages/auth/Login";

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/feed" element={<p>pagina do feed</p>} />
        <Route path="/register" element={<p>pagina de cadastro</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const email = () => screen.getByPlaceholderText("Digite seu email");
const senha = () => screen.getByPlaceholderText("Digite sua senha");
const entrar = () => screen.getByRole("button", { name: "Entrar" });

describe("tela de login", () => {
  beforeEach(() => {
    mocks.auth = { loading: false, user: null };
    mocks.signIn.mockReset().mockResolvedValue({});
    mocks.google.mockReset().mockResolvedValue({});
    mocks.success.mockReset();
    mocks.error.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("não tenta entrar com campos vazios e leva o foco ao primeiro campo vazio", () => {
    renderLogin();
    fireEvent.click(entrar());
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(email()).toHaveFocus();

    fireEvent.change(email(), { target: { value: "ana@runnex.app" } });
    fireEvent.click(entrar());
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(senha()).toHaveFocus();
  });

  it("entra com e-mail e senha e vai para o feed", async () => {
    renderLogin();
    fireEvent.change(email(), { target: { value: "ana@runnex.app" } });
    fireEvent.change(senha(), { target: { value: "segredo123" } });
    fireEvent.click(entrar());

    expect(await screen.findByText("pagina do feed")).toBeInTheDocument();
    expect(mocks.signIn).toHaveBeenCalledWith({ name: "auth-de-teste" }, "ana@runnex.app", "segredo123");
    expect(mocks.success).toHaveBeenCalledWith("Login realizado com sucesso!");
  });

  it("mostra a mensagem em português quando a senha está errada e continua na tela", async () => {
    mocks.signIn.mockRejectedValue({ code: "auth/invalid-credential" });
    renderLogin();
    fireEvent.change(email(), { target: { value: "ana@runnex.app" } });
    fireEvent.change(senha(), { target: { value: "errada" } });
    fireEvent.click(entrar());

    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Email ou senha incorretos."));
    expect(screen.queryByText("pagina do feed")).toBeNull();
    expect(entrar()).not.toBeDisabled();
  });

  it("entra com o Google", async () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: /Continuar com Google/ }));
    expect(await screen.findByText("pagina do feed")).toBeInTheDocument();
    expect(mocks.google).toHaveBeenCalledTimes(1);
  });

  it("mostra e esconde a senha", () => {
    renderLogin();
    expect(senha()).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(senha()).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(senha()).toHaveAttribute("type", "password");
  });

  it("quem já está logado vai direto para o feed", async () => {
    mocks.auth = { loading: false, user: { uid: "ana" } };
    renderLogin();
    expect(await screen.findByText("pagina do feed")).toBeInTheDocument();
  });

  it("leva para o cadastro", async () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByText("pagina de cadastro")).toBeInTheDocument();
  });
});
