"use client";
import { useState, useTransition } from "react";
import { backupNow } from "@/app/actions/backup";

type File = { name: string; created_at: string | null; size: number | null };

const when = (f: File) => {
  const m = /^backup-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/.exec(f.name);
  const d = f.created_at ? new Date(f.created_at) : m ? new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00Z`) : null;
  return d
    ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d)
    : f.name;
};

export function BackupPanel({ files, ready }: { files: File[]; ready: boolean }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <a href="/api/export" className="btn-primary w-full sm:w-auto">
          ⬇ Download everything as Excel
        </a>
        <p className="text-xs text-muted">Lessons and notes, money by month, packages and payments, students, and topic progress — one sheet each.</p>
      </div>
      <div className="space-y-2">
        <h3 className="font-medium">Automatic weekly backup</h3>
        {!ready ? <p className="rounded-xl bg-warn-soft p-3 text-sm text-warn">Run database update 0012 to turn on backups.</p> : null}
        <p className="text-sm text-muted">
          A full copy is saved by itself once a week (the newest 12 are kept). If anything is ever deleted by mistake, it can be put back from here.
        </p>
        <button
          type="button"
          className="btn-secondary"
          disabled={pending || !ready}
          onClick={() =>
            start(async () => {
              const r = await backupNow();
              setMsg(r.ok ?? r.error ?? null);
            })
          }
        >
          {pending ? "Backing up…" : "Back up now"}
        </button>
        {msg ? <p className="text-sm text-accent">{msg}</p> : null}
        {files.length ? (
          <ul className="space-y-1 text-sm">
            {files.map((f) => (
              <li key={f.name} className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2">
                <span>{when(f)}</span>
                <a href={`/api/backups/${f.name}`} className="text-accent underline">
                  Download
                </a>
              </li>
            ))}
          </ul>
        ) : ready ? (
          <p className="text-sm text-muted">No backups yet — the first one is made the next time you open Home.</p>
        ) : null}
      </div>
    </div>
  );
}
