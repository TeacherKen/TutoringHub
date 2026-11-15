// A half-done puzzle kept on the child's device, so closing a game (to do maths, say) and coming back
// later carries on where they left off. One saved puzzle per game; cleared when it's finished.

export function readKept<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(`tutoringhub.keep.${key}`) ?? "null") as T | null;
  } catch {
    return null;
  }
}

export function writeKept(key: string, value: unknown) {
  try {
    if (value == null) localStorage.removeItem(`tutoringhub.keep.${key}`);
    else localStorage.setItem(`tutoringhub.keep.${key}`, JSON.stringify(value));
  } catch {
    /* private browsing: just don't keep it */
  }
}
