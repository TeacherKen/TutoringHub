import { afterEach, describe, expect, it, vi } from "vitest";
import { aiAvailable, writeWithAI } from "@/lib/ai";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ANTHROPIC_API_KEY;
});

describe("built-in AI parent message", () => {
  it("is off without a key", async () => {
    expect(aiAvailable()).toBe(false);
    expect((await writeWithAI("x".repeat(30))).error).toBeTruthy();
  });
  it("sends a Messages API request and returns the text", async () => {
    process.env.ANTHROPIC_API_KEY = "k";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ content: [{ type: "text", text: "Dear parent" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await writeWithAI("Write a message about the lesson");
    expect(r.text).toBe("Dear parent");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("k");
    const body = JSON.parse(String(init.body));
    expect(body.messages[0].content).toContain("Write a message");
    expect(body.temperature).toBeUndefined();
  });
  it("explains a bad key", async () => {
    process.env.ANTHROPIC_API_KEY = "bad";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    expect((await writeWithAI("Write a message about the lesson")).error).toMatch(/key/i);
  });
});
