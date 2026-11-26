import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  getVipInfo: vi.fn(),
  mockActivateVip: vi.fn(),
  mockDeactivateVip: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/services/vipApi", () => ({
  getVipInfo: (...a: unknown[]) => mocks.getVipInfo(...a),
  mockActivateVip: (...a: unknown[]) => mocks.mockActivateVip(...a),
  mockDeactivateVip: (...a: unknown[]) => mocks.mockDeactivateVip(...a),
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: vi.fn() } }));

import VipCard, { VIP_BENEFITS } from "@/pages/app/profile/VipCard";

describe("cartão do plano VIP", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("lista os benefícios e diz que a ativação ainda não está disponível", async () => {
    mocks.getVipInfo.mockResolvedValue({ mockActivation: false });
    render(<VipCard userId="ana" isVip={false} onChange={vi.fn()} />);
    for (const benefit of VIP_BENEFITS) expect(screen.getByText(new RegExp(benefit))).toBeTruthy();
    await waitFor(() => expect(mocks.getVipInfo).toHaveBeenCalled());
    expect(screen.getByText(/Ativação disponível em breve/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("se o servidor não responder, trata como indisponível", async () => {
    mocks.getVipInfo.mockRejectedValue(new Error("offline"));
    render(<VipCard userId="ana" isVip={false} onChange={vi.fn()} />);
    expect(await screen.findByText(/Ativação disponível em breve/)).toBeTruthy();
  });

  it("no modo de teste, ativa o VIP e avisa quem usa o cartão", async () => {
    mocks.getVipInfo.mockResolvedValue({ mockActivation: true });
    mocks.mockActivateVip.mockResolvedValue({ isVip: true });
    const onChange = vi.fn();
    render(<VipCard userId="ana" isVip={false} onChange={onChange} />);
    expect(await screen.findByText(/Modo de teste: nenhuma cobrança é feita/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Ativar VIP/ }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(true));
    expect(mocks.mockActivateVip).toHaveBeenCalledWith("ana");
  });

  it("VIP ativo mostra o selo e permite desativar", async () => {
    mocks.getVipInfo.mockResolvedValue({ mockActivation: true });
    mocks.mockDeactivateVip.mockResolvedValue({ isVip: false });
    const onChange = vi.fn();
    render(<VipCard userId="ana" isVip onChange={onChange} />);
    expect(screen.getByText("Ativo")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /Desativar VIP/ }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(false));
  });

  it("falha ao ativar mostra erro e não muda o estado", async () => {
    mocks.getVipInfo.mockResolvedValue({ mockActivation: true });
    mocks.mockActivateVip.mockRejectedValue(new Error("500"));
    const onChange = vi.fn();
    render(<VipCard userId="ana" isVip={false} onChange={onChange} />);
    fireEvent.click(await screen.findByRole("button", { name: /Ativar VIP/ }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();
  });
});
