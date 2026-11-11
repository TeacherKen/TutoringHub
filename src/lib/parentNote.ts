// The short note Mr Ken sends parents after a lesson: a greeting, the family page link and his sign-off.
// The full feedback (with topics, homework and work photos) is on the family page itself.

export function parentNote(parentName: string | null | undefined, names: string, url: string): string {
  const hello = parentName?.trim() ? `Hi ${parentName.trim()}!` : "Hi!";
  return `${hello} Here's the feedback for today updated.\n\nYou can see ${names}'s lessons and progress anytime here: ${url}\n\nBest wishes\nKenneth`;
}
