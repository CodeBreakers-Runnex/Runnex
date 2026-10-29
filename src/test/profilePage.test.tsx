import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { FeedActivity, UserProfile, UserStats } from "@/types";

const mocks = vi.hoisted(() => ({
  // Mesmo objeto em toda renderização, como o useAuth real.
  auth: { user: { uid: "ana", displayName: "Ana Souza", photoURL: null, providerData: [] } },
  signOut: vi.fn(),
  updateProfile: vi.fn(),
  getUserStats: vi.fn(),
  getUserProfile: vi.fn(),
  getUserActivities: vi.fn(),
  createUserProfile: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/config/firebase", () => ({ auth: { signOut: () => mocks.signOut() }, db: {}, storage: {} }));
vi.mock("firebase/auth", () => ({ updateProfile: (...a: unknown[]) => mocks.updateProfile(...a) }));
vi.mock("@/services/database", () => ({
  getUserStats: (...a: unknown[]) => mocks.getUserStats(...a),
  getUserProfile: (...a: unknown[]) => mocks.getUserProfile(...a),
  getUserActivities: (...a: unknown[]) => mocks.getUserActivities(...a),
  createUserProfile: (...a: unknown[]) => mocks.createUserProfile(...a),
  deleteUserActivities: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => mocks.success(...a), error: (...a: unknown[]) => mocks.error(...a), warning: vi.fn(), info: vi.fn() } }));
vi.mock("@/components/DeleteAccountSection", () => ({ default: () => null }));
vi.mock("@/components/ExportDataButton", () => ({ default: () => null }));

import Profile from "@/pages/app/Profile";

const stats: UserStats = {
  totalKm: "42.0", runsCount: 2, totalTime: "3h 30m", totalCalories: 2100, averagePace: "5'00\"",
  currentStreak: 2, weeklyTotalKm: 5, bestActivity: null, lastActivity: null, weeklyData: [],
  hasHourLongRun: false, hasSub10kRun: false, dawnRunsCount: 0, nightRunsCount: 0,
};

function profile(extra: Partial<UserProfile> = {}): UserProfile {
  return { uid: "ana", displayName: "Ana Souza", photoURL: null, totalXP: 0, level: "Iniciante", monthlyKm: 0, weeklyGoalKm: 10, ...extra };
}

function run(id: string): FeedActivity {
  return { id, userId: "ana", userName: "Ana Souza", userAvatar: null, distance: 5, time: "25:00", durationSeconds: 1500, pace: "5'00\"", type: "RUNNING", likes: [], createdAtMs: Date.UTC(2026, 9, 20) };
}

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={["/profile"]}>
      <Routes>
        <Route path="/profile" element={<Profile />} />
        <Route path="/login" element={<p>tela de login</p>} />
        <Route path="/tenis" element={<p>tela de tenis</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function abrirEdicao() {
  fireEvent.click(await screen.findByRole("button", { name: "Editar perfil" }));
  return screen.findByRole("button", { name: "SALVAR ALTERAÇÕES" });
}

describe("perfil", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.signOut.mockReset().mockResolvedValue(undefined);
    mocks.updateProfile.mockReset().mockResolvedValue(undefined);
    mocks.getUserStats.mockReset().mockResolvedValue(stats);
    mocks.getUserProfile.mockReset().mockResolvedValue(profile());
    mocks.getUserActivities.mockReset().mockResolvedValue([]);
    mocks.createUserProfile.mockReset().mockResolvedValue(undefined);
    mocks.success.mockReset();
    mocks.error.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("carrega nome, histórico e busca os dados da própria pessoa", async () => {
    mocks.getUserActivities.mockResolvedValue([run("1"), run("2")]);
    renderProfile();
    expect(await screen.findByText("2 corridas")).toBeInTheDocument();
    expect(screen.getAllByText("Ana Souza").length).toBeGreaterThan(0);
    expect(mocks.getUserStats).toHaveBeenCalledWith("ana");
    expect(mocks.getUserProfile).toHaveBeenCalledWith("ana");
    expect(mocks.getUserActivities).toHaveBeenCalledWith("ana", 20);
  });

  it("sem corridas, mostra o histórico vazio", async () => {
    renderProfile();
    expect(await screen.findByText("Nenhuma corrida no histórico")).toBeInTheDocument();
  });

  it("não mostra sono nem dispositivos conectados nesta versão", async () => {
    renderProfile();
    await screen.findByText("Nenhuma corrida no histórico");
    expect(screen.queryByText("Sono e recuperação")).toBeNull();
    expect(screen.queryByText("Dispositivos conectados")).toBeNull();
    expect(screen.getByText("Meus tênis")).toBeInTheDocument();
  });

  it("salva a edição do perfil e limita a meta semanal a 500 km", async () => {
    renderProfile();
    const salvar = await abrirEdicao();
    fireEvent.change(screen.getByDisplayValue("Ana Souza"), { target: { value: "  Ana Corredora  " } });
    fireEvent.change(screen.getByPlaceholderText("Ex: São Paulo, SP"), { target: { value: "Campinas, SP" } });
    fireEvent.change(screen.getByDisplayValue("10"), { target: { value: "900" } });
    fireEvent.click(salvar);

    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Perfil atualizado!"));
    expect(mocks.updateProfile).toHaveBeenCalledWith(mocks.auth.user, { displayName: "Ana Corredora", photoURL: null });
    expect(mocks.createUserProfile).toHaveBeenCalledWith("ana", {
      displayName: "Ana Corredora", photoURL: null, bio: "", location: "Campinas, SP", weeklyGoalKm: 500,
    });
    // Recarrega os dados do perfil depois de salvar.
    await waitFor(() => expect(mocks.getUserProfile).toHaveBeenCalledTimes(2));
  });

  it("não salva com o nome vazio", async () => {
    renderProfile();
    const salvar = await abrirEdicao();
    fireEvent.change(screen.getByDisplayValue("Ana Souza"), { target: { value: "   " } });
    fireEvent.click(salvar);

    expect(mocks.error).toHaveBeenCalledWith("O nome não pode ficar vazio");
    expect(mocks.updateProfile).not.toHaveBeenCalled();
    expect(mocks.createUserProfile).not.toHaveBeenCalled();
  });

  it("foto em base64 vai só para o banco, não para o Firebase Auth", async () => {
    const foto = "data:image/png;base64,AAAA";
    mocks.getUserProfile.mockResolvedValue(profile({ photoURL: foto }));
    renderProfile();
    fireEvent.click(await abrirEdicao());

    await waitFor(() => expect(mocks.createUserProfile).toHaveBeenCalled());
    expect(mocks.updateProfile).toHaveBeenCalledWith(mocks.auth.user, { displayName: "Ana Souza" });
    expect(mocks.createUserProfile.mock.calls[0][1]).toMatchObject({ photoURL: foto });
  });

  it("avisa quando não consegue salvar", async () => {
    mocks.createUserProfile.mockRejectedValue(new Error("offline"));
    renderProfile();
    fireEvent.click(await abrirEdicao());
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Erro ao atualizar perfil"));
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("sai da conta e volta para o login", async () => {
    renderProfile();
    fireEvent.click(await screen.findByRole("button", { name: /SAIR DA CONTA/ }));
    expect(await screen.findByText("tela de login")).toBeInTheDocument();
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it("abre a tela de tênis", async () => {
    renderProfile();
    fireEvent.click(await screen.findByText("Meus tênis"));
    expect(await screen.findByText("tela de tenis")).toBeInTheDocument();
  });
});
