import "server-only";

// Writes the parent message with Claude (Anthropic's API), from the same prompt the
// "Copy prompt for ChatGPT" button makes. Only used when ANTHROPIC_API_KEY is set.

const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-haiku-5-5";

export function aiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export async function writeWithAI(prompt: string): Promise<{ text?: string; error?: string }> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return { error: "AI isn't set up yet." };
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL,
        max_tokens: 700,
        system:
          "You write short, warm, specific lesson updates from a private maths tutor to a parent. Use only the facts given. Output only the message.",
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    if (!res.ok) {
      if (res.status === 401) return { error: "The AI key isn't working. Check ANTHROPIC_API_KEY in Vercel." };
      if (res.status === 429) return { error: "AI is busy right now — try again in a minute." };
      return { error: "AI couldn't write the message. Try again, or use the ChatGPT button." };
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (data.content ?? [])
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text)
      .join("\n")
      .trim();
    return text ? { text } : { error: "AI didn't return a message. Try again." };
  } catch {
    return { error: "AI took too long to answer. Try again." };
  }
}
