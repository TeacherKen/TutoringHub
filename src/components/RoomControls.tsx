"use client";
import { useState, useTransition } from "react";
import { ensureRoomToken, resetRoomToken, setGamesOpen } from "@/app/actions/rooms";

type S = { id: string; first_name: string; room_token: string | null; games_open: boolean };

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** On a lesson page: share each student's room link, and open/close break-time games. */
export function RoomControls({ students, showGames = true }: { students: S[]; showGames?: boolean }) {
  const [tokens, setTokens] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(students.map((s) => [s.id, s.room_token])),
  );
  const [open, setOpen] = useState(students.some((s) => s.games_open));
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const linkFor = (token: string) => `${window.location.origin}/room/${token}`;
  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 4000);
  };

  async function getToken(s: S): Promise<string | null> {
    if (tokens[s.id]) return tokens[s.id];
    const r = await ensureRoomToken(s.id);
    if (r.token) {
      setTokens((t) => ({ ...t, [s.id]: r.token! }));
      return r.token;
    }
    flash(r.error ?? "Couldn't make the link.");
    return null;
  }

  async function share(s: S) {
    const token = await getToken(s);
    if (!token) return;
    const url = linkFor(token);
    const text = `Hi ${s.first_name}! Here is your maths lesson room with Mr Ken: ${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${s.first_name}'s lesson room`, text, url });
        return;
      } catch {
        /* cancelled — fall back to copy */
      }
    }
    flash((await copyText(url)) ? `${s.first_name}'s link copied — paste it into your chat.` : url);
  }

  async function copy(s: S) {
    const token = await getToken(s);
    if (token) flash((await copyText(linkFor(token))) ? `${s.first_name}'s link copied.` : linkFor(token));
  }

  async function preview(s: S) {
    const token = await getToken(s);
    if (token) window.open(linkFor(token), "_blank", "noopener");
  }

  async function reset(s: S) {
    if (!confirm(`Make a new link for ${s.first_name}? The old link will stop working.`)) return;
    const r = await resetRoomToken(s.id);
    if (r.token) {
      setTokens((t) => ({ ...t, [s.id]: r.token! }));
      flash(`New link made for ${s.first_name}. Send it to them again.`);
    }
  }

  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="h2">Student room</h2>
        {showGames ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await setGamesOpen(
                  students.map((s) => s.id),
                  !open,
                );
                if (r.ok) setOpen(!open);
              })
            }
            className={open ? "btn-danger min-h-11" : "btn-primary min-h-11"}
          >
            {open ? "Close games" : "Open games (break)"}
          </button>
        ) : null}
      </div>
      <p className="text-sm text-muted">
        Each student has one private link. It always shows the slides for their current or next lesson.
        {showGames ? " Games stay locked until you open them, and close by themselves after 45 minutes." : ""}
      </p>
      {students.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 p-3">
          <span className="font-medium">{s.first_name}</span>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary min-h-10 px-3 text-sm" onClick={() => share(s)}>
              Send link
            </button>
            <button type="button" className="btn-secondary min-h-10 px-3 text-sm" onClick={() => copy(s)}>
              Copy
            </button>
            <button type="button" className="btn-secondary min-h-10 px-3 text-sm" onClick={() => preview(s)}>
              Preview
            </button>
            {tokens[s.id] ? (
              <button type="button" className="text-xs text-muted underline" onClick={() => reset(s)}>
                New link
              </button>
            ) : null}
          </div>
        </div>
      ))}
      {msg ? (
        <p role="status" className="break-all rounded-xl bg-accent-soft p-3 text-sm text-accent">
          {msg}
        </p>
      ) : null}
    </section>
  );
}
