// Tests the database security rules directly (not the screens).
// Runs the real migration in an in-memory Postgres (PGlite) with a small
// stand-in for Supabase's auth.jwt(), then signs in as each kind of user.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const TUTOR = "ken@example.com";
const VIEWER = "best@example.com";
const STRANGER = "someone@example.com";
const PARENT = "parent@example.com";

let db: PGlite;

async function as<T = Record<string, unknown>>(email: string | null, sql: string, params: unknown[] = []) {
  await db.exec("reset role;");
  const claims = email ? JSON.stringify({ email, role: "authenticated" }) : "{}";
  await db.query("select set_config('request.jwt.claims', $1, false)", [claims]);
  await db.exec(email ? "set role authenticated;" : "set role anon;");
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role;");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.jwt() to anon, authenticated;
  `);
  const sql = readFileSync(join(__dirname, "../supabase/migrations/0001_init.sql"), "utf8").replace(
    "create extension if not exists pgcrypto;",
    "",
  );
  await db.exec(sql);
  // Supabase gives these grants by default; RLS does the real protection.
  await db.exec(`
    grant usage on schema public to anon, authenticated;
    grant all on all tables in schema public to anon, authenticated;
    insert into app_users (email, role) values
      ('${TUTOR}', 'tutor'), ('${VIEWER}', 'viewer'), ('${PARENT}', 'parent');
    insert into hour_accounts (id, name) values ('00000000-0000-0000-0000-00000000000a', 'Jaian & Nivaan');
    insert into students (id, first_name, parent_name, contact, mode, place, keywords, private_notes, hour_account_id)
      values ('00000000-0000-0000-0000-000000000001', 'Jaian', 'Ms A', '+66 000', 'onsite', 'Nana', '{Jaian}', 'secret note',
              '00000000-0000-0000-0000-00000000000a');
    insert into lessons (id, event_uid, occurrence_key, start_at, end_at, title, learned, final_message)
      values ('00000000-0000-0000-0000-0000000000b1', 'uid1', 'single', now() + interval '1 day',
              now() + interval '1 day 1 hour', 'Jaian maths', 'fractions', 'Dear Ms A ...');
    insert into lesson_students (lesson_id, student_id) values
      ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000001');
    insert into packages (hour_account_id, hours, price_thb, start_date)
      values ('00000000-0000-0000-0000-00000000000a', 12, 33600, current_date);
    update private_settings set ical_url = 'https://calendar.google.com/secret/abc' where id = 1;
  `);
});

const privateTables = [
  "students",
  "lessons",
  "lesson_students",
  "lesson_materials",
  "packages",
  "hour_adjustments",
  "hour_accounts",
  "settings",
  "parent_links",
  "quiz_results",
];

describe("tutor", () => {
  it("can read students, notes and packages", async () => {
    expect((await as(TUTOR, "select private_notes from students")).length).toBe(1);
    expect((await as(TUTOR, "select learned, final_message from lessons")).length).toBe(1);
    expect((await as(TUTOR, "select * from packages")).length).toBe(1);
  });
  it("can manage who has access", async () => {
    await as(TUTOR, "insert into app_users (email, role) values ('new@example.com', 'viewer')");
    expect((await as(TUTOR, "select * from app_users")).length).toBe(4);
    await as(TUTOR, "delete from app_users where email = 'new@example.com'");
  });
  it("cannot read the secret calendar link from the database directly", async () => {
    expect(await as(TUTOR, "select ical_url from private_settings")).toEqual([]);
  });
});

describe("viewer (family member)", () => {
  for (const table of privateTables) {
    it(`cannot read ${table}`, async () => {
      expect(await as(VIEWER, `select * from ${table}`)).toEqual([]);
    });
  }
  it("cannot read the calendar link", async () => {
    expect(await as(VIEWER, "select * from private_settings")).toEqual([]);
  });
  it("cannot change data", async () => {
    await as(VIEWER, "update lessons set learned = 'hacked'");
    await as(VIEWER, "update students set private_notes = 'hacked'");
    const rows = await as<{ learned: string }>(TUTOR, "select learned from lessons");
    expect(rows[0].learned).toBe("fractions");
  });
  it("cannot give itself tutor access", async () => {
    await expect(as(VIEWER, `update app_users set role = 'tutor' where email = '${VIEWER}'`)).resolves.toEqual([]);
    const rows = await as<{ role: string }>(TUTOR, `select role from app_users where email = '${VIEWER}'`);
    expect(rows[0].role).toBe("viewer");
    await expect(
      as(VIEWER, `insert into app_users (email, role) values ('x@example.com', 'tutor')`),
    ).rejects.toThrow();
  });
  it("sees its own role", async () => {
    expect(await as(VIEWER, "select role from app_users")).toEqual([{ role: "viewer" }]);
  });
  it("gets the schedule with only safe fields", async () => {
    const rows = await as<Record<string, unknown>>(
      VIEWER,
      "select * from viewer_schedule(now() - interval '1 day', now() + interval '7 days')",
    );
    expect(rows.length).toBe(1);
    expect(Object.keys(rows[0]).sort()).toEqual(
      ["end_at", "is_preply", "lesson_id", "mode", "place", "start_at", "students"].sort(),
    );
    expect(rows[0].students).toBe("Jaian");
    expect(rows[0].place).toBe("Nana");
    expect(JSON.stringify(rows)).not.toContain("secret note");
    expect(JSON.stringify(rows)).not.toContain("fractions");
  });
});

describe("other people", () => {
  it("a stranger cannot read anything or use the schedule", async () => {
    for (const table of privateTables) {
      expect(await as(STRANGER, `select * from ${table}`)).toEqual([]);
    }
    await expect(
      as(STRANGER, "select * from viewer_schedule(now(), now() + interval '1 day')"),
    ).rejects.toThrow(/not allowed/);
  });
  it("a parent account has no access yet (Phase 2)", async () => {
    expect(await as(PARENT, "select * from students")).toEqual([]);
    await expect(
      as(PARENT, "select * from viewer_schedule(now(), now() + interval '1 day')"),
    ).rejects.toThrow(/not allowed/);
  });
  it("signed-out visitors cannot read anything", async () => {
    expect(await as(null, "select * from students")).toEqual([]);
    expect(await as(null, "select * from app_users")).toEqual([]);
  });
});
