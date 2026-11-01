import "server-only";
import { createClient } from "@/lib/supabase/server";
import { costUsd, cycleStart, nextCycle, usd, type Usage } from "@/lib/aiCost";
import { makeHider, type Hider } from "@/lib/hideNames";
import { fmtDate } from "@/lib/time";

// Every AI request in TutoringHub goes through here:
//   1. check this month's spending (the app stops itself before the Console's $5 limit);
//   2. send the request (names are already hidden by the caller, using hiderForEveryone());
//   3. write down what it cost, so Settings can show "AI this month".

const API_URL = "https://api.anthropic.com/v1/messages";

/** The app stops using AI after this much in one month (US dollars). */
export const aiLimit = () => {
  const n = Number(process.env.AI_MONTHLY_LIMIT_USD);
  return Number.isFinite(n) && n > 0 ? n : 4.5;
};
/** The day of the month the Console credit renews. */
export const cycleDay = () => {
  const n = Number(process.env.AI_CYCLE_DAY);
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : 28;
};

export const aiKey = () => process.env.ANTHROPIC_API_KEY?.trim() || null;

export type AiBudget = {
  spent: number;
  limit: number;
  ok: boolean;
  metered: boolean;
  resetsOn: string;
  /** What it was spent on this month, e.g. { lesson_summary: { uses: 12, cost: 0.62 } }. */
  byFeature: Record<string, { uses: number; cost: number }>;
};

/** How much AI has cost since the credit last renewed. `metered` is false before database update 0020. */
export async function aiBudget(): Promise<AiBudget> {
  const now = new Date();
  const limit = aiLimit();
  const resetsOn = fmtDate(nextCycle(now, cycleDay()).toISOString());
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_usage")
    .select("feature, cost_usd")
    .gte("created_at", cycleStart(now, cycleDay()).toISOString())
    .limit(10_000);
  if (error) return { spent: 0, limit, ok: true, metered: false, resetsOn, byFeature: {} };
  const byFeature: AiBudget["byFeature"] = {};
  let spent = 0;
  for (const r of (data ?? []) as { feature?: string; cost_usd: number }[]) {
    const cost = Number(r.cost_usd || 0);
    spent += cost;
    const f = (byFeature[r.feature ?? "other"] ??= { uses: 0, cost: 0 });
    f.uses++;
    f.cost += cost;
  }
  return { spent, limit, ok: spent < limit, metered: true, resetsOn, byFeature };
}

/** Everyone whose name must not reach the AI: students, parents and family members. */
export async function hiderForEveryone(): Promise<Hider> {
  const supabase = await createClient();
  const [{ data: students }, { data: users }] = await Promise.all([
    supabase.from("students").select("first_name, parent_name"),
    supabase.from("app_users").select("display_name, role").neq("role", "tutor"),
  ]);
  const kids = (students ?? []) as { first_name: string; parent_name: string | null }[];
  const others = ((users ?? []) as { display_name: string | null }[]).map((u) => u.display_name).filter((n): n is string => !!n?.trim());
  return makeHider({
    students: kids.map((k) => ({ name: k.first_name })),
    parents: [...kids.map((k) => k.parent_name).filter((n): n is string => !!n?.trim()), ...others].map((name) => ({ name })),
  });
}

export type ClaudeRequest = {
  /** For the meter, e.g. "parent_message". */
  feature: string;
  model: string;
  max_tokens: number;
  system: string;
  messages: { role: "user" | "assistant"; content: unknown }[];
  output_config?: Record<string, unknown>;
  thinking?: Record<string, unknown>;
  timeoutMs?: number;
};
type ContentBlock = { type: string; text?: string };
export type ClaudeReply = { text: string; stop: string | null };

/** Send one request to Claude. Returns the answer's text, or an error in plain words. */
export async function callClaude(req: ClaudeRequest): Promise<{ reply?: ClaudeReply; error?: string; limit?: boolean }> {
  const key = aiKey();
  if (!key) return { error: "AI isn't set up yet. Add ANTHROPIC_API_KEY in Vercel (Settings → Environment Variables), then redeploy." };
  const budget = await aiBudget();
  if (!budget.ok) {
    return {
      limit: true,
      error: `AI has used this month's ${usd(budget.limit)}. It starts again on ${budget.resetsOn}. Until then, use the ChatGPT button.`,
    };
  }
  const { feature, timeoutMs = 90_000, ...body } = req;
  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch {
    return { error: "AI took too long to answer. Try again." };
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`AI ${feature} failed`, res.status, detail.slice(0, 500));
    if (res.status === 401 || res.status === 403) return { error: "The AI key isn't working. Check ANTHROPIC_API_KEY in Vercel." };
    if (/credit balance|spend(ing)? limit|usage limit|billing/i.test(detail)) {
      return { limit: true, error: "This month's AI credit has run out (the limit in the Claude Console). It comes back when the credit renews. Until then, use the ChatGPT button." };
    }
    if (res.status === 429 || res.status === 529 || res.status >= 500) return { error: "AI is busy right now. Try again in a minute." };
    if (/image|media|url/i.test(detail)) return { error: "AI couldn't open one of the pictures. Try again, or remove a very large photo." };
    return { error: "AI couldn't do that. Try again." };
  }
  const data = (await res.json().catch(() => null)) as { content?: ContentBlock[]; usage?: Usage; stop_reason?: string } | null;
  if (!data) return { error: "AI sent back something unreadable. Try again." };
  // Write down the cost (before database update 0020 this quietly does nothing).
  try {
    const supabase = await createClient();
    const u = data.usage ?? {};
    await supabase.from("ai_usage").insert({
      feature,
      model: req.model,
      input_tokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
      output_tokens: u.output_tokens ?? 0,
      cost_usd: Math.round(costUsd(req.model, u) * 100_000) / 100_000,
    });
  } catch {
    /* the answer still counts */
  }
  const text = (data.content ?? [])
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text)
    .join("\n")
    .trim();
  if (data.stop_reason === "refusal") return { error: "AI wouldn't answer that one. Try again, or write it yourself." };
  return { reply: { text, stop: data.stop_reason ?? null } };
}

/** Read the JSON answer of a structured-output request. */
export function parseJson(reply: ClaudeReply): unknown {
  try {
    return JSON.parse(reply.text);
  } catch {
    const m = /\{[\s\S]*\}/.exec(reply.text);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}
