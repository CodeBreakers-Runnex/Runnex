import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SideNav from "@/components/SideNav";
import { features } from "@/config/features";

describe("funcionalidades desligadas nesta versão", () => {
  it("sono, relógio, sensor cardíaco e música estão desligados", () => {
    expect(features).toEqual({ sleep: false, healthConnectRuns: false, heartRateSensor: false, music: false });
  });

  it("o menu não mostra o sono e mantém as telas da versão", () => {
    render(<MemoryRouter><SideNav /></MemoryRouter>);
    expect(screen.queryByText("Sono e recuperação")).toBeNull();
    for (const label of ["Início", "Estatísticas", "Social", "Eventos", "Treinos", "Pet", "Conquistas", "Treinador", "Meus tênis", "Perfil"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });
});
