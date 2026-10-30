"use client";
import { useState, useTransition } from "react";
import { ensureRoomToken, resetRoomToken, setGamesOpen, setStudentSlides } from "@/app/actions/rooms";
import { WatchScreen } from "./WatchScreen";
import { SmartSlides } from "./SmartSlides";

type S = { id: string; first_name: string; room_token: string | null; games_open: boolean; slides_url: string | null; slides_label: string | null; board_id?: string | null };

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** On a lesson page: share each student's room link, and open/close break-time games. */
export function RoomControls({ students, showGames = true, lessonId }: { students: S[]; showGames?: boolean; lessonId?: string | null }) {
  const [tokens, setTokens] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(students.map((s) => [s.id, s.room_token])),
  );
  const [open, setOpen] = useState(students.some((s) => s.games_open));
  const [msg, setMsg] = useState<string | null>(null);
  const [watching, setWatching] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; what: "copy" | "send" } | null>(null);
  const tick = (id: string, what: "copy" | "send") => {
    setDone({ id, what });
    setTimeout(() => setDone((d) => (d?.id === id && d.what === what ? null : d)), 2500);
  };
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
    const ok = await copyText(url);
    if (ok) tick(s.id, "send");
    flash(ok ? `${s.first_name}'s link copied — paste it into your chat.` : url);
  }

  async function copy(s: S) {
    const token = await getToken(s);
    if (!token) return;
    const ok = await copyText(linkFor(token));
    if (ok) tick(s.id, "copy");
    flash(ok ? `${s.first_name}'s link copied.` : linkFor(token));
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
                if (r.ok) {
                  setOpen(!open);
                  if (open) setWatching(null);
                  else if (students.length === 1) setWatching(students[0].id);
                }
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
        {showGames
          ? " Games stay locked until you open them, and close by themselves after 45 minutes. While they're open, tap Watch to see their game screen."
          : ""}
      </p>
      {students.map((s) => (
        <div key={s.id} className="space-y-3 rounded-xl bg-surface-2 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">{s.first_name}</span>
            <div className="flex flex-wrap items-center gap-2">
              {showGames && open ? (
                <button
                  type="button"
                  className={watching === s.id ? "btn-secondary min-h-10 px-3 text-sm" : "btn-primary min-h-10 px-3 text-sm"}
                  onClick={() => setWatching(watching === s.id ? null : s.id)}
                >
                  {watching === s.id ? "Stop watching" : "Watch"}
                </button>
              ) : null}
              <button type="button" className="btn-primary min-h-10 px-3 text-sm" onClick={() => share(s)}>
                {done?.id === s.id && done.what === "send" ? "✓ Link copied" : "Send link"}
              </button>
              <button
                type="button"
                className={`${done?.id === s.id && done.what === "copy" ? "btn-primary" : "btn-secondary"} min-h-10 px-3 text-sm`}
                onClick={() => copy(s)}
              >
                {done?.id === s.id && done.what === "copy" ? "✓ Copied" : "Copy"}
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
          <SmartSlides studentId={s.id} name={s.first_name} currentId={s.board_id ?? null} lessonId={lessonId} />
          <SlidesField student={s} />
          {showGames && open && watching === s.id ? <WatchScreen studentId={s.id} name={s.first_name} /> : null}
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

function SlidesField({ student }: { student: S }) {
  const [url, setUrl] = useState(student.slides_url ?? "");
  const [label, setLabel] = useState(student.slides_label ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | string>(student.slides_url ? "saved" : "idle");
  const changed = url !== (student.slides_url ?? "") || label !== (student.slides_label ?? "");
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("saving");
        const r = await setStudentSlides(student.id, url, label);
        setState(r.ok ? "saved" : (r.error ?? "Couldn't save."));
      }}
    >
      <span className="label">{student.first_name}&apos;s current slides (always in their room)</span>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Name, e.g. Alice Prep #52"
          className="input sm:w-56"
          maxLength={80}
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          type="url"
          inputMode="url"
          placeholder="Paste a Canva link"
          className="input flex-1"
        />
        <button className="btn-secondary shrink-0" disabled={state === "saving" || (!changed && state === "saved")}>
          {state === "saving" ? "Saving…" : !changed && state === "saved" && url ? "Saved ✓" : url ? "Save" : "Save"}
        </button>
      </div>
      {state !== "idle" && state !== "saving" && state !== "saved" ? <p className="text-sm text-danger">{state}</p> : null}
      {url && !changed ? (
        <button
          type="button"
          className="text-xs text-muted underline"
          onClick={async () => {
            setUrl("");
            setLabel("");
            const r = await setStudentSlides(student.id, "", "");
            setState(r.ok ? "idle" : (r.error ?? "Couldn't save."));
          }}
        >
          Remove current slides
        </button>
      ) : null}
    </form>
  );
}
