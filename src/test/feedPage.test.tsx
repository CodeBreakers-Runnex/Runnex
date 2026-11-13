import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { FeedActivity } from "@/types";

const mocks = vi.hoisted(() => ({
  feed: [] as FeedActivity[],
  more: [] as FeedActivity[],
  toggleLike: vi.fn(),
  loadMore: vi.fn(),
  getFeed: vi.fn(),
  unsubscribe: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/config/firebase", () => ({ auth: {}, db: {}, storage: {} }));
// Mesmo objeto em toda renderização, como o useAuth real: a tela recarrega as
// estatísticas quando o usuário muda.
const authState = vi.hoisted(() => ({ user: { uid: "ana", displayName: "Ana", photoURL: null, providerData: [] } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => authState }));
vi.mock("@/services/database", () => ({
  subscribeToFeed: (cb: (data: FeedActivity[]) => void) => { cb(mocks.feed); return mocks.unsubscribe; },
  toggleLike: (...a: unknown[]) => mocks.toggleLike(...a),
  getUserStats: () => Promise.resolve({ totalKm: "12.5", runsCount: 3, totalTime: "1h 5m" }),
  loadMoreActivities: (...a: unknown[]) => mocks.loadMore(...a),
  getFeed: (...a: unknown[]) => mocks.getFeed(...a),
}));
vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => mocks.success(...a), info: (...a: unknown[]) => mocks.info(...a), error: (...a: unknown[]) => mocks.error(...a) } }));

import Feed from "@/pages/app/Feed";

// Puxar para atualizar: arrasta de cima para baixo com a página no topo.
function pullToRefresh() {
  fireEvent.touchStart(document, { touches: [{ clientY: 10 }] });
  fireEvent.touchMove(document, { touches: [{ clientY: 310 }] });
  fireEvent.touchEnd(document);
}

function run(id: string, userId: string, userName: string, extra: Partial<FeedActivity> = {}): FeedActivity {
  return {
    id, userId, userName, userAvatar: null, distance: 5, time: "25:00", durationSeconds: 1500,
    pace: "5'00\"", type: "RUNNING", likes: [], createdAtMs: Date.UTC(2026, 9, 20, 10), ...extra,
  };
}

function renderFeed() {
  return render(
    <MemoryRouter initialEntries={["/feed"]}>
      <Routes>
        <Route path="/feed" element={<Feed />} />
        <Route path="/run" element={<p>tela de corrida</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("feed", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.feed = [];
    // O backend devolve a lista de curtidas já atualizada.
    mocks.toggleLike.mockReset().mockResolvedValue([]);
    mocks.getFeed.mockReset().mockResolvedValue([]);
    mocks.loadMore.mockReset().mockResolvedValue([]);
    mocks.unsubscribe.mockReset();
    mocks.success.mockReset();
    mocks.info.mockReset();
    mocks.error.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("sem corridas, mostra o estado vazio com atalho para correr", async () => {
    renderFeed();
    expect(await screen.findByText("Nenhuma corrida ainda")).toBeInTheDocument();
  });

  it("lista as corridas recebidas", async () => {
    mocks.feed = [run("1", "bruno", "Bruno"), run("2", "carla", "Carla", { distance: 10.5 })];
    renderFeed();
    expect(await screen.findAllByText("Bruno")).not.toHaveLength(0);
    expect(screen.getAllByText("Carla")).not.toHaveLength(0);
    expect(screen.getByText("10.50")).toBeInTheDocument();
  });

  it("curtir chama o backend com o estado atual da curtida", async () => {
    mocks.feed = [run("1", "bruno", "Bruno"), run("2", "carla", "Carla", { likes: ["ana"] })];
    renderFeed();
    const curtir = await screen.findByRole("button", { name: "Curtir corrida" });
    fireEvent.click(curtir);
    expect(mocks.toggleLike).toHaveBeenCalledWith("1", "ana", false);

    fireEvent.click(screen.getByRole("button", { name: "Descurtir corrida" }));
    expect(mocks.toggleLike).toHaveBeenCalledWith("2", "ana", true);
  });

  it("avisa quando a curtida não é salva", async () => {
    mocks.toggleLike.mockRejectedValue(new Error("offline"));
    mocks.feed = [run("1", "bruno", "Bruno")];
    renderFeed();
    fireEvent.click(await screen.findByRole("button", { name: "Curtir corrida" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Não foi possível salvar a curtida. Tente de novo."));
  });

  it("a curtida aparece na hora, sem esperar a próxima atualização do feed", async () => {
    mocks.toggleLike.mockResolvedValue(["ana"]);
    mocks.feed = [run("1", "bruno", "Bruno")];
    renderFeed();
    fireEvent.click(await screen.findByRole("button", { name: "Curtir corrida" }));
    expect(await screen.findByRole("button", { name: "Descurtir corrida" })).toBeInTheDocument();
  });

  it("a curtida também aparece nas corridas carregadas por \"ver mais\"", async () => {
    mocks.feed = Array.from({ length: 10 }, (_, i) => run(String(10 - i), "bruno", "Bruno", { likes: ["ana"] }));
    mocks.loadMore.mockResolvedValue([run("0", "dani", "Dani")]);
    mocks.toggleLike.mockResolvedValue(["ana"]);
    renderFeed();
    fireEvent.click(await screen.findByRole("button", { name: /Ver mais atividades/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Curtir corrida" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Curtir corrida" })).toBeNull());
    expect(mocks.toggleLike).toHaveBeenCalledWith("0", "ana", false);
  });

  it("puxar para atualizar busca o feed de novo", async () => {
    mocks.feed = [run("1", "bruno", "Bruno")];
    mocks.getFeed.mockResolvedValue([run("2", "carla", "Carla"), run("1", "bruno", "Bruno")]);
    renderFeed();
    await screen.findAllByText("Bruno");
    pullToRefresh();
    expect((await screen.findAllByText("Carla")).length).toBeGreaterThan(0);
    expect(mocks.getFeed).toHaveBeenCalledWith(10);
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Feed atualizado!"));
  });

  it("se a atualização falhar, avisa em vez de dizer que atualizou", async () => {
    mocks.feed = [run("1", "bruno", "Bruno")];
    mocks.getFeed.mockRejectedValue(new Error("offline"));
    renderFeed();
    await screen.findAllByText("Bruno");
    pullToRefresh();
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Não foi possível atualizar o feed. Tente de novo."));
    expect(mocks.success).not.toHaveBeenCalledWith("Feed atualizado!");
    expect(screen.getAllByText("Bruno").length).toBeGreaterThan(0);
  });

  it("a busca filtra pelo nome do atleta e avisa quando não acha ninguém", async () => {
    mocks.feed = [run("1", "bruno", "Bruno"), run("2", "carla", "Carla")];
    renderFeed();
    const busca = await screen.findByPlaceholderText("Buscar atletas ou atividades...");

    fireEvent.change(busca, { target: { value: "zé" } });
    expect(await screen.findByText(/Nenhum resultado para/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar busca" }));
    await waitFor(() => expect(screen.queryByText(/Nenhum resultado para/)).toBeNull());
    expect(busca).toHaveValue("");
  });

  it("carrega mais corridas a partir da última e para quando acabam", async () => {
    mocks.feed = Array.from({ length: 10 }, (_, i) => run(String(10 - i), "bruno", "Bruno"));
    mocks.loadMore.mockResolvedValue([run("0", "dani", "Dani")]);
    renderFeed();

    fireEvent.click(await screen.findByRole("button", { name: /Ver mais atividades/ }));
    expect(mocks.loadMore).toHaveBeenCalledWith("1", 10);
    expect((await screen.findAllByText("Dani")).length).toBeGreaterThan(0);
    expect(screen.getByText(/você chegou ao início do feed/)).toBeInTheDocument();
  });

  it("o sino resume as curtidas recebidas nas corridas da própria pessoa", async () => {
    mocks.feed = [run("1", "ana", "Ana", { likes: ["bruno", "carla"] }), run("2", "bruno", "Bruno", { likes: ["ana"] })];
    renderFeed();
    fireEvent.click(await screen.findByRole("button", { name: "Ver curtidas recebidas" }));
    expect(mocks.success).toHaveBeenCalledWith("❤️ Suas atividades têm 2 curtidas no total!");
  });

  it("para de ouvir o feed ao sair da tela", async () => {
    const { unmount } = renderFeed();
    await screen.findByText("Nenhuma corrida ainda");
    unmount();
    await waitFor(() => expect(mocks.unsubscribe).toHaveBeenCalledTimes(1));
  });
});
