// Builds the text that is pasted into ChatGPT to write the parent message.
// All prompt-building lives here, so built-in AI can replace the copy/paste
// step later by sending this same prompt to an AI service.

export const TONES = {
  warm: "warm, encouraging and professional",
  formal: "polite, formal and professional",
  brief: "friendly and to the point",
} as const;
export type Tone = keyof typeof TONES;

export const DEFAULT_TEMPLATE = `You are helping a private maths tutor (Singapore Maths) write a short update to a parent after today's lesson.

Write the message to {{parent}} about {{student}} ({{level}}).
Tone: {{tone}}.
Length: 120–180 words. Plain, simple English that parents who speak English as a second language can follow.
{{emoji_rule}}

Structure:
1. Greeting using the parent's name.
2. What we learned today — be specific about the maths.
3. What went well.
4. What to work on, explained kindly and specifically (which topic, what kind of mistake).
5. Homework, if any.
6. What we will do next lesson.
7. A short friendly sign-off from {{tutor}}.

Rules:
- Only use the facts in the notes below. Do not invent anything.
- You may mention the progress so far in one short sentence, but focus on today.
- Avoid vague phrases such as "making good progress" or "doing great" without saying what exactly.
- Do not include any surnames, school names or contact details.
- Output only the message, ready to send.

Lesson notes:
- Date: {{date}}
- Learned today: {{learned}}
- How it went: {{how_it_went}}
- Topics: {{topics}}
- Progress so far: {{progress}}
- Homework: {{homework}}
- Next time: {{next_time}}`;

const HOW = { great: "Great", good: "Good", needs_practice: "Needs more practice" } as const;

export type PromptInput = {
  studentNames: string[];
  parentName: string | null;
  level: string | null;
  date: string;
  learned: string | null;
  nextTime: string | null;
  homework: string | null;
  howItWent: keyof typeof HOW | null;
  topics: string[];
  tutorName: string;
  tone: Tone | string;
  allowEmoji: boolean;
  template?: string | null;
  progress?: string | null;
};

/** First word only — the prompt never carries surnames, even if one was typed. */
export function firstNameOnly(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

export function buildFeedbackPrompt(i: PromptInput): string {
  const names = i.studentNames.map(firstNameOnly).filter(Boolean);
  const student = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "the student");
  const values: Record<string, string> = {
    parent: i.parentName?.trim() || "the parent",
    student,
    level: i.level?.trim() || "primary",
    tone: TONES[i.tone as Tone] ?? String(i.tone),
    emoji_rule: i.allowEmoji ? "You may use one or two friendly emojis." : "Do not use emojis.",
    tutor: i.tutorName.trim() || "your tutor",
    date: i.date,
    learned: i.learned?.trim() || "(not written)",
    how_it_went: i.howItWent ? HOW[i.howItWent] : "(not given)",
    topics: i.topics.length ? i.topics.join(", ") : "(none)",
    homework: i.homework?.trim() || "None this time",
    next_time: i.nextTime?.trim() || "(not written)",
    progress: i.progress?.trim() || "(not tracked)",
  };
  const template = i.template?.trim() ? i.template : DEFAULT_TEMPLATE;
  return template.replace(/\{\{(\w+)\}\}/g, (m, key: string) => (key in values ? values[key] : m));
}
