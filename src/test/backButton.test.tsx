import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { pushBackHandler, runTopBackHandler } from "@/lib/backButton";
import { useBackHandler } from "@/hooks/useBackHandler";

function Modal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useBackHandler(open, onClose);
  return null;
}

describe("botão voltar do Android", () => {
  it("sem handlers, devolve false para o app navegar", () => {
    expect(runTopBackHandler()).toBe(false);
  });

  it("atende só o handler do topo e respeita a remoção", () => {
    const page = vi.fn();
    const modal = vi.fn();
    const removePage = pushBackHandler(page);
    const removeModal = pushBackHandler(modal);

    expect(runTopBackHandler()).toBe(true);
    expect(modal).toHaveBeenCalledTimes(1);
    expect(page).not.toHaveBeenCalled();

    removeModal();
    runTopBackHandler();
    expect(page).toHaveBeenCalledTimes(1);

    removePage();
    expect(runTopBackHandler()).toBe(false);
  });

  it("o hook registra só enquanto o modal está aberto", () => {
    const onClose = vi.fn();
    const { rerender, unmount } = render(<Modal open={false} onClose={onClose} />);
    expect(runTopBackHandler()).toBe(false);

    rerender(<Modal open onClose={onClose} />);
    expect(runTopBackHandler()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<Modal open={false} onClose={onClose} />);
    expect(runTopBackHandler()).toBe(false);

    rerender(<Modal open onClose={onClose} />);
    unmount();
    expect(runTopBackHandler()).toBe(false);
  });

  it("usa sempre a versão mais nova do handler", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = render(<Modal open onClose={first} />);
    rerender(<Modal open onClose={second} />);
    runTopBackHandler();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    unmount();
  });
});
