"use client";
import { netFail } from "@/lib/netFail";
import { useState, useTransition } from "react";
import { setAiPictures } from "@/app/actions/settings";

/** Settings: the switch that lets the AI read pictures of written work. */
export function AiPicturesSwitch({ initial, ready }: { initial: boolean; ready: boolean }) {
  const [on, setOn] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-1.5">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 accent-[var(--accent)]"
          checked={on}
          disabled={pending || !ready}
          onChange={(e) => {
            const next = e.target.checked;
            setOn(next);
            setMsg(null);
            start(async () => {
              const r = await setAiPictures(next).catch(netFail);
              if (r.error) {
                setOn(!next);
                setMsg(r.error);
              } else setMsg(next ? "On: the AI reads pictures of written work." : "Off: the AI reads your typed notes only.");
            });
          }}
        />
        <span>
          <span className="font-medium">Let the AI read pictures of written work</span>
          <span className="block text-sm text-muted">
            Worksheet photos and the smart-slide pages from a lesson, so the summary can see each answer and mistake. Names are never sent, but a child may have
            written their name on the page. Off: the AI reads only your typed notes and times tables results.
          </span>
        </span>
      </label>
      {!ready ? <p className="text-sm text-warn">Run database update 0020 to use this switch.</p> : null}
      {msg ? (
        <p role="status" className="text-sm text-muted">
          {msg}
        </p>
      ) : null}
    </div>
  );
}
