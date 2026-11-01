import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A pretend database: the students and parents whose names must be hidden, and the AI meter.
const db: Record<string, Record<string, unknown>[]> = {};
const inserted: Record<string, unknown>[] = [];
function query(table: string) {
  const res = { data: db[table] ?? [], error: null };
  const b: Record<string, unknown> = {
    select: () => b,
    neq: () => b,
    eq: () => b,
    gte: () => b,
    limit: () => b,
    insert: async (row: Record<string, unknown>) => {
      inserted.push({ table, ...row });
      return { error: null };
    },
    then: (ok: (v: typeof res) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(res).then(ok, bad),
  };
  return b;
}
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: query }) }));

const { aiAvailable, writeWithAI } = await import("@/lib/ai");

beforeEach(() => {
  db.students = [
    { first_name: "Jaian", parent_name: "Ms Aradhana" },
    { first_name: "IQ", parent_name: "Ms Gloy" },
  ];
  db.app_users = [{ display_name: "Best", role: "viewer" }];
  db.ai_usage = [];
  inserted.length = 0;
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ANTHROPIC_API_KEY;
});

const reply = (text: string, usage = { input_tokens: 1000, output_tokens: 200 }) =>
  new Response(JSON.stringify({ content: [{ type: "text", text }], usage, stop_reason: "end_turn" }), { status: 200 });

describe("built-in AI parent message", () => {
  it("is off without a key", async () => {
    expect(aiAvailable()).toBe(false);
    expect((await writeWithAI("x".repeat(30))).error).toBeTruthy();
  });

  it("sends a quick Messages API request and returns the text", async () => {
    process.env.ANTHROPIC_API_KEY = "k";
    const fetchMock = vi.fn(async () => reply("Dear parent"));
    vi.stubGlobal("fetch", fetchMock);
    const r = await writeWithAI("Write a message about the lesson");
    expect(r.text).toBe("Dear parent");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("k");
    const body = JSON.parse(String(init.body));
    expect(body.messages[0].content).toContain("Write a message");
    expect(body.model).toBe("claude-haiku-5-5");
    expect(body.thinking).toEqual({ type: "disabled" });
    expect(body.output_config).toEqual({ effort: "low" });
    expect(body.temperature).toBeUndefined();
  });

  it("never sends names, and puts them back in the answer", async () => {
    process.env.ANTHROPIC_API_KEY = "k";
    const fetchMock = vi.fn(async () => reply("Dear {parent1},\n{child1} worked hard on long division. {child2} was absent."));
    vi.stubGlobal("fetch", fetchMock);
    const r = await writeFeedback("Write the message to Ms Aradhana about Jaian (P4). Jaian's brother sat with IQ. Best says hi.");
    const sent = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    const text = JSON.stringify(sent);
    for (const name of ["Jaian", "Aradhana", "IQ", "Best"]) expect(text).not.toContain(name);
    expect(sent.messages[0].content).toContain("{parent1}");
    expect(sent.messages[0].content).toContain("{child1}'s brother");
    expect(r.text).toBe("Dear Ms Aradhana,\nJaian worked hard on long division. IQ was absent.");
  });

  it("writes down what each use cost", async () => {
    process.env.ANTHROPIC_API_KEY = "k";
    vi.stubGlobal("fetch", vi.fn(async () => reply("Hi", { input_tokens: 2000, output_tokens: 400 })));
    await writeWithAI("Write a message about the lesson");
    const row = inserted.find((r) => r.table === "ai_usage");
    expect(row).toMatchObject({ feature: "parent_message", model: "claude-haiku-5-5", input_tokens: 2000, output_tokens: 400 });
    expect(row?.cost_usd).toBeCloseTo((2000 * 0.1 + 400 * 0.5) / 1e6, 6);
  });

  it("stops by itself once this month's limit is used", async () => {
    process.env.ANTHROPIC_API_KEY = "k";
    db.ai_usage = [{ cost_usd: 3 }, { cost_usd: 1.6 }];
    const fetchMock = vi.fn(async () => reply("Hi"));
    vi.stubGlobal("fetch", fetchMock);
    const r = await writeWithAI("Write a message about the lesson");
    expect(r.error).toMatch(/starts again/);
    expect(r.error).toMatch(/ChatGPT/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("explains a bad key and an empty credit balance", async () => {
    process.env.ANTHROPIC_API_KEY = "bad";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    expect((await writeWithAI("Write a message about the lesson")).error).toMatch(/key/i);
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":{"message":"Your credit balance is too low"}}', { status: 400 })));
    expect((await writeWithAI("Write a message about the lesson")).error).toMatch(/credit has run out/);
  });
});

async function writeFeedback(prompt: string) {
  return writeWithAI(prompt);
}
