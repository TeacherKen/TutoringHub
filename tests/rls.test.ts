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

async function as<T = Record<string, unknown>>(
  email: string | null,
  sql: string,
  params: unknown[] = [],
  opts: { provider?: string } = {},
) {
  await db.exec("reset role;");
  const claims = email
    ? JSON.stringify({ email, role: "authenticated", app_metadata: { provider: opts.provider ?? "google" } })
    : "{}";
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
    create role service_role nologin;
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
  for (const f of ["0003_multiple_calendars.sql", "0004_no_duplicate_students.sql", "0005_rooms_and_tracking.sql", "0006_watch_games.sql", "0007_pinned_slides.sql", "0008_topic_progress.sql", "0009_smart_slides.sql"]) {
    await db.exec(readFileSync(join(__dirname, "../supabase/migrations", f), "utf8"));
  }
  // Supabase gives these grants by default; RLS does the real protection.
  await db.exec(`
    set search_path = tutoring, public;
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
    insert into calendar_sources (label, ical_url) values ('Lessons', 'https://calendar.google.com/secret/abc');
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
  it("cannot read the secret calendar links from the browser side", async () => {
    expect(await as(TUTOR, "select ical_url from private_settings")).toEqual([]);
    await expect(as(TUTOR, "select ical_url from calendar_sources")).rejects.toThrow(/permission denied/);
  });
});

describe("viewer (family member)", () => {
  for (const table of privateTables) {
    it(`cannot read ${table}`, async () => {
      expect(await as(VIEWER, `select * from ${table}`)).toEqual([]);
    });
  }
  it("cannot read the calendar links", async () => {
    expect(await as(VIEWER, "select * from private_settings")).toEqual([]);
    await expect(as(VIEWER, "select * from calendar_sources")).rejects.toThrow(/permission denied/);
  });
  it("cannot see students' game screens", async () => {
    await as(TUTOR, "insert into room_screens (student_id, game, html) values ('00000000-0000-0000-0000-000000000001', 'tt', '<p>x</p>')");
    expect((await as(TUTOR, "select * from room_screens")).length).toBe(1);
    expect(await as(VIEWER, "select * from room_screens")).toEqual([]);
    expect(await as(PARENT, "select * from room_screens")).toEqual([]);
  });
  it("cannot see topic progress", async () => {
    await as(TUTOR, "insert into student_topics (student_id, name, status) values ('00000000-0000-0000-0000-000000000001', 'fractions', 'got_it')");
    expect((await as(TUTOR, "select * from student_topics")).length).toBe(1);
    expect(await as(VIEWER, "select * from student_topics")).toEqual([]);
    expect(await as(PARENT, "select * from student_topics")).toEqual([]);
    await as(VIEWER, "update student_topics set status = 'next'");
    expect((await as<{ status: string }>(TUTOR, "select status from student_topics"))[0].status).toBe("got_it");
  });
  it("cannot see smart slides or the writing on them", async () => {
    const B = "00000000-0000-0000-0000-0000000000c1";
    await as(TUTOR, `insert into boards (id, student_id, title, pages, aspect) values ('${B}', '00000000-0000-0000-0000-000000000001', 'Fractions', 2, 0.5625)`);
    await as(TUTOR, `insert into board_marks (id, board_id, page, author, data) values ('00000000-0000-0000-0000-0000000000d1', '${B}', 0, 'student', '{"t":"pen"}')`);
    for (const t of ["boards", "board_marks", "board_live"]) {
      expect(await as(VIEWER, `select * from ${t}`)).toEqual([]);
      expect(await as(PARENT, `select * from ${t}`)).toEqual([]);
    }
    const before = await as<{ rev: string }>(TUTOR, "select rev from board_marks");
    await as(TUTOR, "update board_marks set deleted = true");
    const after = await as<{ rev: string }>(TUTOR, "select rev from board_marks");
    expect(Number(after[0].rev)).toBeGreaterThan(Number(before[0].rev)); // rubbing out counts as a change
  });
  it("closing games clears the game screen", async () => {
    await as(TUTOR, "update students set games_open = true");
    await as(TUTOR, "update students set games_open = false");
    expect(await as(TUTOR, "select * from room_screens")).toEqual([]);
  });
  it("cannot see any student's room link", async () => {
    await as(TUTOR, "update students set room_token = 'secret-room-token-abcdefghijkl'");
    expect(await as(VIEWER, "select room_token from students")).toEqual([]);
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
    expect(JSON.stringify(rows)).not.toContain("Jaian maths"); // raw calendar title never shown
    expect(JSON.stringify(rows)).not.toContain("secret note");
    expect(JSON.stringify(rows)).not.toContain("fractions");
  });
});

describe("other people", () => {
  it("someone using the tutor's email WITHOUT Google sign-in gets nothing", async () => {
    expect(await as(TUTOR, "select * from students", [], { provider: "email" })).toEqual([]);
    expect(await as(TUTOR, "select * from app_users", [], { provider: "email" })).toEqual([]);
    await expect(
      as(TUTOR, "select * from viewer_schedule(now(), now() + interval '1 day')", [], { provider: "email" }),
    ).rejects.toThrow(/not allowed/);
  });
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
  it("signed-out visitors are refused outright", async () => {
    await expect(as(null, "select * from students")).rejects.toThrow(/permission denied/);
    await expect(as(null, "select * from app_users")).rejects.toThrow(/permission denied/);
    await expect(as(null, "select * from viewer_schedule(now(), now() + interval '1 day')")).rejects.toThrow(
      /permission denied/,
    );
  });
});
