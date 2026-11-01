// After signing in, go back to the page you asked for (e.g. the games corner on the iPad).
// Only paths inside this app are allowed, never another website.

export const NEXT_COOKIE = "th_next";

/** "/arcade" → "/arcade"; "https://evil.com", "//evil.com" or junk → null. */
export function safeNext(value: string | null | undefined): string | null {
  if (!value || value.length > 200) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (/[\u0000-\u001f\\]/.test(value)) return null;
  if (value === "/login" || value.startsWith("/login?") || value.startsWith("/auth/")) return null;
  return value;
}

/** Pages that open as their own home-screen app and so need their own sign-in screen. */
export const isArcade = (next: string | null) => next === "/arcade" || Boolean(next?.startsWith("/arcade/"));
