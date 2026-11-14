// The short note Mr Ken sends parents after a lesson: a greeting, the family page link and his sign-off.
// The full feedback (with topics, homework and work photos) is on the family page itself.

/** Mr Ken's sign-off on every message to parents. */
export const SIGN_OFF = "Best wishes\nKenneth";

/** "Hi Ms Aradhana!" (or "Hi!" without a name). */
export const hello = (parentName: string | null | undefined) => (parentName?.trim() ? `Hi ${parentName.trim()}!` : "Hi!");

/** The family page line. */
export const familyLine = (names: string, url: string) => `You can see ${names}'s lessons and progress anytime here: ${url}`;

export function parentNote(parentName: string | null | undefined, names: string, url: string): string {
  return `${hello(parentName)} Here's the feedback for today updated.\n\n${familyLine(names, url)}\n\n${SIGN_OFF}`;
}

/** Adds the family page line to a message, just above the sign-off (or at the end if there isn't one). */
export function addFamilyLine(text: string, names: string, url: string): string {
  const t = text.trimEnd();
  const line = familyLine(names, url);
  const i = t.lastIndexOf(SIGN_OFF);
  if (i >= 0 && i === t.length - SIGN_OFF.length) return `${t.slice(0, i).trimEnd()}\n\n${line}\n\n${SIGN_OFF}`;
  return `${t}\n\n${line}`;
}
