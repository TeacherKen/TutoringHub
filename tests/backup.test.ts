import { beforeEach, describe, expect, it, vi } from "vitest";

const uploads: { name: string; body: string }[] = [];
let files: string[] = [];
const removed: string[][] = [];
const tables: Record<string, Record<string, unknown>[]> = {
  students: [{ id: "s1", first_name: "Alice", room_token: "SECRET-TOKEN" }],
  lessons: [{ id: "l1", learned: "fractions" }],
  packages: [{ id: "p1", hours: 12, price_thb: 33600 }],
};

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: (t: string) => ({
      select: () => ({
        order: () => ({
          range: async () => (t in tables ? { data: tables[t], error: null } : t === "settings" ? { data: [], error: null } : { data: null, error: { message: "missing table" } }),
        }),
        eq: () => ({ maybeSingle: async () => ({ data: { last_backup_at: null }, error: null }) }),
      }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
    storage: {
      from: () => ({
        upload: async (name: string, blob: Blob) => {
          uploads.push({ name, body: await blob.text() });
          files.push(name);
          return { error: null };
        },
        list: async () => ({ data: [...files].sort().reverse().map((name) => ({ name, created_at: null, metadata: {} })), error: null }),
        remove: async (names: string[]) => {
          removed.push(names);
          files = files.filter((f) => !names.includes(f));
          return { error: null };
        },
      }),
    },
  }),
}));

describe("weekly backup", () => {
  beforeEach(() => {
    uploads.length = 0;
    removed.length = 0;
    files = [];
  });

  it("saves every table but leaves out students' room links", async () => {
    const { makeBackup } = await import("@/lib/backup");
    const r = await makeBackup();
    expect(r.ok).toBe(true);
    const saved = JSON.parse(uploads[0].body);
    expect(saved.tables.students[0]).toEqual({ id: "s1", first_name: "Alice" });
    expect(saved.tables.lessons[0].learned).toBe("fractions");
    expect(uploads[0].body).not.toContain("SECRET-TOKEN");
    expect(saved.tables.boards).toEqual([]); // missing tables are skipped, not fatal
  });

  it("keeps only the newest 12", async () => {
    files = Array.from({ length: 12 }, (_, i) => `backup-2026-0${Math.floor(i / 9) + 1}-${String((i % 9) + 10)}-00-00.json`);
    const { makeBackup } = await import("@/lib/backup");
    await makeBackup();
    expect(removed.flat()).toHaveLength(1);
    expect(files).toHaveLength(12);
    expect(removed.flat()[0]).toBe("backup-2026-01-10-00-00.json"); // the oldest one went
  });
});
