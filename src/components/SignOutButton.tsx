"use client";

/** Signs out and removes any unsaved lesson-note backups from this device. */
export function SignOutButton({ className, children = "Sign out" }: { className?: string; children?: React.ReactNode }) {
  return (
    <form
      action="/signout"
      method="post"
      className="contents"
      onSubmit={() => {
        try {
          for (const k of Object.keys(window.localStorage)) {
            if (k.startsWith("th-note-")) window.localStorage.removeItem(k);
          }
        } catch {
          /* nothing stored */
        }
      }}
    >
      <button className={className}>{children}</button>
    </form>
  );
}
