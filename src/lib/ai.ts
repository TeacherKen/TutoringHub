import "server-only";
import { aiKey, callClaude, hiderForEveryone } from "@/lib/aiCall";
import { MODELS } from "@/lib/aiCost";
import { NAMES_NOTE } from "@/lib/hideNames";

// Writes the parent message with Claude (Anthropic's API), from the same prompt the
// "Copy prompt for ChatGPT" button makes. Only used when ANTHROPIC_API_KEY is set.
// Names are swapped for placeholders before sending, and put back in the answer.

export function aiAvailable(): boolean {
  return Boolean(aiKey());
}

const SYSTEM = `You write short, warm, specific lesson updates from a private maths tutor to a parent. Use only the facts given. Output only the message.

${NAMES_NOTE}`;

export async function writeWithAI(prompt: string, feature = "parent_message"): Promise<{ text?: string; error?: string }> {
  const names = await hiderForEveryone();
  const r = await callClaude({
    feature,
    model: process.env.ANTHROPIC_MODEL?.trim() || MODELS.quick,
    max_tokens: 1500,
    // Quick writing: no long thinking, short and to the point.
    thinking: { type: "disabled" },
    output_config: { effort: "low" },
    system: SYSTEM,
    messages: [{ role: "user", content: names.hide(prompt) }],
    timeoutMs: 45_000,
  });
  if (!r.reply) return { error: r.error };
  const text = names.show(r.reply.text);
  return text ? { text } : { error: "AI didn't return a message. Try again." };
}
