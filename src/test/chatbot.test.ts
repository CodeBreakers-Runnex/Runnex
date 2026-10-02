import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { api } = vi.hoisted(() => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("@/services/apiClient", () => ({ api }));

import { sendChatbotMessage } from "@/services/chatbotApi";
import { clearCoachHistory, createCoachMessage, loadCoachHistory, saveCoachHistory } from "@/lib/coachHistory";

describe("chatbotApi", () => {
  beforeEach(() => {
    api.post.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("envia a mensagem sem espaços extras e o fuso do aparelho", async () => {
    api.post.mockResolvedValue({ reply: "Olá!" });
    vi.spyOn(Date.prototype, "getTimezoneOffset").mockReturnValue(180); // Brasília

    await expect(sendChatbotMessage("  minhas estatísticas ")).resolves.toBe("Olá!");
    expect(api.post).toHaveBeenCalledWith("/chatbot/message", {
      message: "minhas estatísticas",
      utcOffsetMinutes: -180,
    });
  });
});

describe("histórico do treinador", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("guarda por usuário e só as 50 mensagens mais recentes", () => {
    const messages = Array.from({ length: 60 }, (_, i) => createCoachMessage(i % 2 ? "coach" : "user", `msg ${i}`));
    saveCoachHistory("ana", messages);

    const loaded = loadCoachHistory("ana");
    expect(loaded).toHaveLength(50);
    expect(loaded[0].text).toBe("msg 10");
    expect(loadCoachHistory("bruno")).toEqual([]);

    clearCoachHistory("ana");
    expect(loadCoachHistory("ana")).toEqual([]);
  });

  it("ignora conteúdo corrompido no localStorage", () => {
    localStorage.setItem("veloxy-coach-ana", "{nao e json");
    expect(loadCoachHistory("ana")).toEqual([]);

    localStorage.setItem("veloxy-coach-ana", JSON.stringify([{ id: 1, text: "sem campos" }, createCoachMessage("user", "ok")]));
    expect(loadCoachHistory("ana").map((m) => m.text)).toEqual(["ok"]);
  });
});
