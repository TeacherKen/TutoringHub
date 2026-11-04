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
Tone: {{tone}}. Warm and positive, like a caring teacher talking to a parent.
Length: about 120–200 words in total. Plain, simple English that parents who speak English as a second language can follow.
{{emoji_rule}}

How the message should feel (Mr Ken's own style):
- Start with a friendly greeting to the parent, e.g. "Hi {{parent}}! Here's the feedback for today:".
- Talk about the learning in big-picture terms: the topic and the skills practised (e.g. "finding common denominators, converting to equivalent fractions and simplifying answers"), how the child is getting on, and the plan for the next lessons.
- Do NOT go through the worksheet question by question. Do not quote questions, numbers or answers from the worksheet (no "7/4 became 1 3/4", no "in 2/3 + 1/2 …"). At most mention the kind of step that needs more practice, in one short phrase (e.g. "remembering to change the answer into a mixed number").
- Be encouraging and honest: what is improving, what we will keep practising, and why.
- With more than one child, write a short paragraph for each child (each child may be learning a different topic), then one short line about both of them together.
- Never say what you could or couldn't see, and never mention pictures, photos or worksheets being missing.
- End with a short friendly sign-off from {{tutor}}.

Example of the style (different children, for style only — do not copy the content):
"Hi Mrs Lee! 😊 Here's the feedback for the boys today:

Ben is making really good progress with multiplication! We've been working on the 2, 3 and 4 times tables, and he is gradually becoming more confident with them. We focused on accuracy and recalling the answers more quickly. Next, I'll keep strengthening these tables before moving on to more challenging questions.

Sam continued working on fractions today, building on his basic understanding before moving on to adding fractions with different denominators. Some questions were quite challenging for his current level, but he is gradually understanding the steps. We'll keep practising to help him become more confident and independent.

Overall, both boys are progressing well, and I'm happy with the effort they're putting into their Maths learning! 😊"

Rules:
- Only use the facts in the notes below (and the lesson's work, if given). Do not invent anything.
- Mention homework only if there is some.
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
    homework: i.homework?.trim() || "(none — don't mention homework)",
    next_time: i.nextTime?.trim() || "(not written)",
    progress: i.progress?.trim() || "(not tracked)",
  };
  const template = i.template?.trim() ? i.template : DEFAULT_TEMPLATE;
  return template.replace(/\{\{(\w+)\}\}/g, (m, key: string) => (key in values ? values[key] : m));
}
