import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

// A weekly copy of everything important (students, lessons, notes, packages, payments,
// topics) as one file, kept in a private storage folder only the app's server can open.
// Secrets are left out: calendar links and students' room links.

export const BACKUP_BUCKET = "tutoring-backups";
const KEEP = 12; // about 3 months of weekly backups
const EVERY_DAYS = 7;

const TABLES: { name: string; order: string; omit?: string[] }[] = [
  { name: "settings", order: "id" },
  { name: "app_users", order: "email" },
  { name: "hour_accounts", order: "id" },
  { name: "students", order: "id", omit: ["room_token"] },
  { name: "lessons", order: "id" },
  { name: "lesson_students", order: "lesson_id" },
  { name: "lesson_materials", order: "id" },
  { name: "packages", order: "id" },
  { name: "hour_adjustments", order: "id" },
  { name: "student_topics", order: "student_id" },
  { name: "boards", order: "id" },
];

export type BackupFile = { name: string; created_at: string | null; size: number | null };

export async function makeBackup(): Promise<{ ok: boolean; name?: string; error?: string }> {
  const admin = createAdminClient();
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin.from(t.name).select("*").order(t.order).range(from, from + 999);
      if (error) break; // table not created yet (database update not run) — skip it
      rows.push(...((data ?? []) as Record<string, unknown>[]));
      if (!data || data.length < 1000) break;
    }
    tables[t.name] = rows.map((r) => {
      const copy = { ...r };
      for (const k of t.omit ?? []) delete copy[k];
      return copy;
    });
  }
  const now = new Date();
  const name = `backup-${now.toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
  const body = JSON.stringify({ app: "TutoringHub", version: 1, created_at: now.toISOString(), tables });
  const { error } = await admin.storage.from(BACKUP_BUCKET).upload(name, new Blob([body], { type: "application/json" }), {
    contentType: "application/json",
    upsert: true,
  });
  if (error) return { ok: false, error: "Couldn't save the backup. Has database update 0012 been run?" };
  await admin.from("settings").update({ last_backup_at: now.toISOString() }).eq("id", 1);

  // Keep only the newest backups.
  const old = (await listBackups()).slice(KEEP).map((f) => f.name);
  if (old.length) await admin.storage.from(BACKUP_BUCKET).remove(old);
  return { ok: true, name };
}

export async function listBackups(): Promise<BackupFile[]> {
  const { data } = await createAdminClient()
    .storage.from(BACKUP_BUCKET)
    .list("", { limit: 100, sortBy: { column: "name", order: "desc" } });
  return (data ?? [])
    .filter((f) => f.name.startsWith("backup-") && f.name.endsWith(".json"))
    .map((f) => ({ name: f.name, created_at: f.created_at ?? null, size: (f.metadata?.size as number | undefined) ?? null }));
}

let lastCheck = 0;

/** Make a backup if the last one is a week old (checked at most once an hour). */
export async function backupIfDue(): Promise<void> {
  if (Date.now() - lastCheck < 3600_000) return;
  lastCheck = Date.now();
  const { data, error } = await createAdminClient().from("settings").select("last_backup_at").eq("id", 1).maybeSingle();
  if (error) return; // database update 0012 not run yet
  const last = data?.last_backup_at ? new Date(data.last_backup_at as string).getTime() : 0;
  if (Date.now() - last < EVERY_DAYS * 86_400_000) return;
  await makeBackup();
}
