import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { RunningEvent } from "@/types";

const mocks = vi.hoisted(() => ({
  // Mesmo objeto em toda renderização, como o useAuth real.
  auth: { user: { uid: "ana", displayName: "Ana Souza", photoURL: null } },
  getUserProfile: vi.fn(),
  getEvents: vi.fn(),
  joinEvent: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/services/database", () => ({
  getUserProfile: (...a: unknown[]) => mocks.getUserProfile(...a),
  getEvents: (...a: unknown[]) => mocks.getEvents(...a),
  joinEvent: (...a: unknown[]) => mocks.joinEvent(...a),
}));
vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => mocks.success(...a), error: (...a: unknown[]) => mocks.error(...a), info: (...a: unknown[]) => mocks.info(...a) } }));

import Events from "@/pages/app/Events";

const DAY = 24 * 60 * 60 * 1000;

function event(id: string, title: string, daysFromNow: number, extra: Partial<RunningEvent> = {}): RunningEvent {
  return {
    id, title, date: "01/12/2026", location: "Parque", city: "Campinas", participantsCount: 3,
    category: "5K", image: "", price: "R$ 80", timestamp: new Date(Date.now() + daysFromNow * DAY), ...extra,
  } as RunningEvent;
}

// O primeiro evento também aparece no destaque do topo; os testes olham a lista.
const lista = () => screen.getByText("Todas as Corridas").closest("section")!.parentElement!.lastElementChild as HTMLElement;
// Sobe a partir do título até o menor bloco que já contém o botão do evento.
const cartao = (title: string) => {
  let el: HTMLElement | null = within(lista()).getByText(title);
  while (el && !el.querySelector("button")) el = el.parentElement;
  return el as HTMLElement;
};

describe("eventos", () => {
  beforeEach(() => {
    mocks.getUserProfile.mockReset().mockResolvedValue({ location: "Campinas, SP", enrolledEvents: [] });
    mocks.getEvents.mockReset().mockResolvedValue([
      event("futuro-5k", "Corrida da Primavera", 10, { category: "5K" }),
      event("futuro-10k", "Desafio 10K", 20, { category: "10K" }),
      event("passado", "Maratona Antiga", -30, { category: "42K" }),
    ]);
    mocks.joinEvent.mockReset().mockResolvedValue(undefined);
    mocks.success.mockReset();
    mocks.error.mockReset();
    mocks.info.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("busca os eventos da cidade do perfil e mostra só os próximos", async () => {
    render(<Events />);
    expect((await screen.findAllByText("Corrida da Primavera")).length).toBeGreaterThan(0);
    expect(mocks.getEvents).toHaveBeenCalledWith("Campinas, SP");
    expect(within(lista()).getByText("Desafio 10K")).toBeInTheDocument();
    expect(within(lista()).queryByText("Maratona Antiga")).toBeNull();
  });

  it("a aba Passados mostra só os que já aconteceram", async () => {
    render(<Events />);
    await screen.findAllByText("Corrida da Primavera");
    fireEvent.click(screen.getByRole("button", { name: "PASSADOS" }));
    expect(within(lista()).getByText("Maratona Antiga")).toBeInTheDocument();
    expect(within(lista()).queryByText("Desafio 10K")).toBeNull();
  });

  it("o filtro de distância esconde os eventos de outras distâncias", async () => {
    render(<Events />);
    await screen.findAllByText("Corrida da Primavera");
    fireEvent.click(screen.getByRole("button", { name: "10K" }));
    expect(within(lista()).getByText("Desafio 10K")).toBeInTheDocument();
    expect(within(lista()).queryByText("Corrida da Primavera")).toBeNull();
  });

  it("salva o evento uma vez e não chama o backend de novo", async () => {
    render(<Events />);
    await screen.findAllByText("Corrida da Primavera");
    fireEvent.click(within(cartao("Corrida da Primavera")).getByRole("button", { name: /Salvar/ }));

    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Evento salvo no perfil."));
    expect(mocks.joinEvent).toHaveBeenCalledWith("futuro-5k", "ana");

    fireEvent.click(within(cartao("Corrida da Primavera")).getByRole("button", { name: /Salvo/ }));
    expect(mocks.info).toHaveBeenCalledWith("Evento ja esta salvo no seu perfil.");
    expect(mocks.joinEvent).toHaveBeenCalledTimes(1);
  });

  it("evento com site oficial abre o site e salva", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    mocks.getEvents.mockResolvedValue([event("oficial", "Meia de Campinas", 5, { officialUrl: "https://exemplo.com/meia" })]);
    render(<Events />);
    await screen.findAllByText("Meia de Campinas");
    fireEvent.click(within(lista()).getByRole("button", { name: /Site oficial/ }));

    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Evento salvo. Abrindo site oficial."));
    expect(open).toHaveBeenCalledWith("https://exemplo.com/meia", "_blank", "noopener,noreferrer");
  });

  it("a aba Inscrito mostra só os eventos salvos", async () => {
    mocks.getUserProfile.mockResolvedValue({ location: "Campinas, SP", enrolledEvents: ["futuro-10k"] });
    render(<Events />);
    await screen.findAllByText("Corrida da Primavera");
    fireEvent.click(screen.getByRole("button", { name: "INSCRITO" }));
    expect(within(lista()).getByText("Desafio 10K")).toBeInTheDocument();
    expect(within(lista()).queryByText("Corrida da Primavera")).toBeNull();
  });

  it("avisa quando não consegue carregar e mostra a lista vazia", async () => {
    mocks.getEvents.mockRejectedValue(new Error("offline"));
    render(<Events />);
    expect(await screen.findByText(/Nenhum evento encontrado/)).toBeInTheDocument();
    expect(mocks.error).toHaveBeenCalledWith("Não foi possível carregar os eventos.");
  });
});
