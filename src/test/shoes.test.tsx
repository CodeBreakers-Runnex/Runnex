import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { FeedActivity, RunningShoe } from "@/types";

const mocks = vi.hoisted(() => ({
  getShoes: vi.fn(),
  createShoe: vi.fn(),
  updateShoe: vi.fn(),
  assignActivityShoe: vi.fn(),
  get: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "ana" } }),
}));
vi.mock("@/services/apiClient", () => ({ api: { get: mocks.get } }));
vi.mock("@/services/shoesApi", async () => {
  const actual = await vi.importActual<typeof import("@/services/shoesApi")>(
    "@/services/shoesApi",
  );
  return { ...actual, ...mocks };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import Shoes from "@/pages/app/Shoes";

const shoe: RunningShoe = {
  id: "1",
  name: "Meu treino",
  brand: null,
  model: null,
  purchaseDate: null,
  initialKm: 475,
  limitKm: 600,
  isDefault: true,
  manuallyWorn: false,
  retired: false,
  totalKm: 480,
  remainingKm: 120,
  usagePercent: 80,
  runsCount: 1,
  status: "attention",
};
const run = {
  id: "12",
  distance: 5,
  time: "30:00",
  shoeId: null,
} as FeedActivity;
const renderPage = () =>
  render(
    <MemoryRouter>
      <Shoes />
    </MemoryRouter>,
  );

describe("controle de tênis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getShoes.mockResolvedValue([shoe]);
    mocks.get.mockResolvedValue([run]);
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });

  it("mostra o estado calculado pelo servidor, alerta e uso inicial", async () => {
    renderPage();
    expect(await screen.findByText("Atenção")).toBeInTheDocument();
    expect(screen.getByText("1 tênis com aviso de uso")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "80",
    );
    expect(screen.getByText(/475 km de uso anterior/)).toBeInTheDocument();
  });

  it("cadastra o primeiro tênis com limite ajustável e padrão selecionado", async () => {
    mocks.getShoes.mockResolvedValue([]);
    mocks.createShoe.mockResolvedValue({
      ...shoe,
      name: "Tênis novo",
      status: "good",
      totalKm: 0,
      initialKm: 0,
    });
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Cadastrar tênis" }),
    );
    fireEvent.change(screen.getByLabelText("Nome do tênis"), {
      target: { value: "Tênis novo" },
    });
    fireEvent.change(screen.getByLabelText(/Limite de uso em quilômetros/), {
      target: { value: "700" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar tênis" }));
    await waitFor(() =>
      expect(mocks.createShoe).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Tênis novo",
          limitKm: 700,
          initialKm: 0,
          isDefault: true,
        }),
      ),
    );
    expect(
      await screen.findByRole("heading", { name: "Tênis novo" }),
    ).toBeInTheDocument();
  });

  it("aposenta o tênis, remove o padrão e permite ver seu histórico", async () => {
    mocks.updateShoe.mockResolvedValue({
      ...shoe,
      retired: true,
      isDefault: false,
      status: "retired",
    });
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Editar Meu treino" }),
    );
    fireEvent.click(
      screen.getByLabelText("Aposentar tênis e preservar seu histórico"),
    );
    expect(screen.getByLabelText("Usar como tênis padrão")).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Salvar tênis" }));
    await waitFor(() =>
      expect(mocks.updateShoe).toHaveBeenCalledWith(
        "1",
        expect.objectContaining({ retired: true, isDefault: false }),
      ),
    );
    expect(await screen.findByText("Nenhum tênis ativo")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Mostrar aposentados"));
    expect(screen.getByText("Aposentado")).toBeInTheDocument();
  });

  it("associa uma corrida anterior e atualiza os totais", async () => {
    mocks.assignActivityShoe.mockResolvedValue({ ...run, shoeId: "1" });
    renderPage();
    const select = await screen.findByLabelText("Tênis da corrida 12");
    fireEvent.change(select, { target: { value: "1" } });
    await waitFor(() =>
      expect(mocks.assignActivityShoe).toHaveBeenCalledWith("12", "1"),
    );
    await waitFor(() => expect(select).toHaveValue("1"));
    expect(mocks.getShoes).toHaveBeenCalledTimes(2);
  });

  it("mostra uma falha de carregamento e permite tentar novamente", async () => {
    mocks.getShoes.mockRejectedValueOnce(new Error("Servidor indisponível"));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Servidor indisponível",
    );
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Atenção")).toBeInTheDocument();
  });
});
