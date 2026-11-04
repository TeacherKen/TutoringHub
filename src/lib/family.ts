import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { MATERIALS_BUCKET } from "@/lib/constants";
import { accountBalance, CHARGED_STATUSES, type HoursLesson } from "@/lib/hours";
import { forecast, type EarnLesson } from "@/lib/earnings";
import { mergeProgress, type TopicRow } from "@/lib/progress";
import { bkkDateKey, bkkStartOfDay, todayKey } from "@/lib/time";
import type { FactState } from "@/lib/facts";
import { loadRounds } from "@/lib/practice";
import { statsFrom, trophies, type Trophy } from "@/lib/trophies";

// A family's private page (opened with a link, no sign-in). It shows only:
// first names, upcoming lesson times, lesson updates Mr Ken marked as sent (his message, the lesson's
// topics, homework and work pictures), topic progress, and hours left. No prices per class, private notes
// ("learned" / "next time" stay Mr Ken's) or other families.

const TOKEN_RE = /^[A-Za-z0-9_-]{24,64}$/;
export const isFamilyToken = (t: string) => TOKEN_RE.test(t);

export type FamilyPage = {
  accountId: string;
  familyName: string;
  consented: boolean;
  children: { id: string; name: string; progress: TopicRow[]; facts: FactState[]; trophies: Trophy[]; stars: number }[];
  upcoming: { start_at: string; end_at: string; names: string[] }[];
  /** Lesson updates Mr Ken sent, newest first: his message, the topics, homework and that lesson's work pictures. */
  messages: { date: string; names: string[]; text: string; topics: string[]; homework: string | null; photos: { label: string; url: string }[] }[];
  work: { label: string; url: string; date: string }[];
  hours: { left: number; bought: number; lessonsLeft: number; endDate: string | null } | null;
  unpaid: { hours: number; price: number }[];
  promptpayId: string | null;
};

type LessonRow = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  length_hours: number | null;
  final_message: string | null;
  sent_at: string | null;
  homework: string | null;
  topics: string[] | null;
  ignored: boolean;
  in_calendar: boolean;
  lesson_students: { student_id: string; uses_hours: boolean; topics?: string[] | null }[];
};

export async function getFamilyPage(token: string): Promise<FamilyPage | null> {
  if (!isFamilyToken(token)) return null;
  const admin = createAdminClient();
  const { data: acct, error } = await admin.from("hour_accounts").select("id, name, family_consent_at").eq("family_token", token).maybeSingle();
  if (error || !acct) return null;

  // Every child on the account counts for hours (a paused sibling's lessons still used them, the same as
  // on Mr Ken's pages); only active children are shown.
  const [{ data: kids }, { data: pk }] = await Promise.all([
    admin.from("students").select("id, first_name, active").eq("hour_account_id", acct.id).order("first_name"),
    admin.from("packages").select("*").eq("hour_account_id", acct.id).order("start_date"),
  ]);
  const everyone = (kids ?? []) as { id: string; first_name: string; active: boolean }[];
  const children = everyone.filter((c) => c.active);
  if (!children.length) return null;
  const ids = children.map((c) => c.id);
  const accountIds = everyone.map((c) => c.id);
  const nameOf = new Map(children.map((c) => [c.id, c.first_name]));
  // Lessons back to the first package (hours), or at least the last 400 days (messages, topics).
  const firstPackage = ((pk ?? []) as { start_date: string }[])[0]?.start_date;
  const since = new Date(Math.min(Date.now() - 400 * 86_400_000, firstPackage ? bkkStartOfDay(firstPackage).getTime() : Infinity)).toISOString();

  const [{ data: links }, { data: adj }, { data: saved }, { data: settings }, { data: factRows }] = await Promise.all([
    admin
      .from("lesson_students")
      .select("lessons!inner(id, start_at, end_at, status, length_hours, final_message, sent_at, homework, topics, ignored, in_calendar, lesson_students(student_id, uses_hours, topics))")
      .in("student_id", accountIds)
      .gte("lessons.start_at", since),
    admin.from("hour_adjustments").select("hours").eq("hour_account_id", acct.id),
    admin.from("student_topics").select("student_id, name, status, updated_at").in("student_id", ids),
    admin.from("settings").select("*").eq("id", 1).maybeSingle(),
    admin.from("fact_progress").select("student_id, fact, box, correct, wrong, avg_ms, due_at, last_seen").in("student_id", ids), // empty until update 0016
  ]);

  const lessons = new Map<string, LessonRow>();
  for (const r of (links ?? []) as unknown as { lessons: LessonRow }[]) lessons.set(r.lessons.id, r.lessons);
  const allAccount = [...lessons.values()].filter((l) => !l.ignored).sort((a, b) => a.start_at.localeCompare(b.start_at));
  // Lessons with one of their (active) children. Messages and work photos only come from lessons where every
  // child is from this family, so a lesson shared with another family never shows that family's work.
  const all = allAccount.filter((l) => l.lesson_students.some((x) => ids.includes(x.student_id)));
  const mineOnly = new Set(accountIds);
  const ownLesson = (l: LessonRow) => l.lesson_students.every((x) => mineOnly.has(x.student_id));
  const namesIn = (l: LessonRow) => [...new Set(l.lesson_students.map((x) => nameOf.get(x.student_id)).filter(Boolean) as string[])];
  const now = Date.now();

  const upcoming = all
    .filter((l) => l.in_calendar && l.status === "scheduled" && new Date(l.end_at).getTime() > now)
    .slice(0, 6)
    .map((l) => ({ start_at: l.start_at, end_at: l.end_at, names: namesIn(l) }));

  const sent = all.filter((l) => ownLesson(l) && l.sent_at && l.final_message?.trim()).reverse();
  const recentSent = sent.slice(0, 8);

  // Saved work pictures from the last 6 weeks.
  const recentIds = [...new Set([...all.filter((l) => ownLesson(l) && new Date(l.start_at).getTime() > now - 42 * 86_400_000).map((l) => l.id), ...recentSent.map((l) => l.id)])];
  let work: FamilyPage["work"] = [];
  const photosOf = new Map<string, { label: string; url: string }[]>();
  if (recentIds.length) {
    const { data: mats } = await admin
      .from("lesson_materials")
      .select("lesson_id, storage_path, label, created_at")
      .in("lesson_id", recentIds)
      .eq("kind", "photo")
      .order("created_at", { ascending: false })
      .limit(24);
    const rows = (mats ?? []).filter((m) => m.storage_path) as { lesson_id: string; storage_path: string; label: string | null; created_at: string }[];
    if (rows.length) {
      const { data: urls } = await admin.storage.from(MATERIALS_BUCKET).createSignedUrls(rows.map((m) => m.storage_path), 2 * 3600);
      const pics = rows
        .map((m, i) => ({ lesson: m.lesson_id, label: (m.label ?? "Work").replace(/ · .*$/, ""), url: urls?.[i]?.signedUrl ?? "", date: bkkDateKey(lessons.get(m.lesson_id)?.start_at ?? m.created_at) }))
        .filter((w) => w.url);
      for (const p of pics) photosOf.set(p.lesson, [...(photosOf.get(p.lesson) ?? []), { label: p.label, url: p.url }]);
      // "Work from lessons" shows pictures not already shown with a lesson update.
      const inUpdates = new Set(recentSent.map((l) => l.id));
      work = pics.filter((p) => !inUpdates.has(p.lesson)).slice(0, 12).map(({ label, url, date }) => ({ label, url, date }));
    }
  }

  const messages = recentSent.map((l) => ({
    date: bkkDateKey(l.start_at),
    names: namesIn(l),
    text: l.final_message!.trim(),
    topics: l.topics ?? [],
    homework: l.homework?.trim() || null,
    photos: photosOf.get(l.id) ?? [],
  }));

  // Topic progress per child.
  const savedRows = (saved ?? []) as { student_id: string; name: string; status: "next" | "learning" | "got_it"; updated_at: string }[];
  const facts = (factRows ?? []) as (FactState & { student_id: string })[];
  const rounds = await loadRounds(ids);
  const childRows = children.map((c) => {
    const mine = facts
      .filter((f) => f.student_id === c.id)
      .map((f): FactState => ({ fact: f.fact, box: f.box, correct: f.correct, wrong: f.wrong, avg_ms: f.avg_ms, due_at: f.due_at, last_seen: f.last_seen }));
    const stats = statsFrom(
      rounds.filter((r) => r.student_id === c.id),
      mine,
    );
    return { c, mine, stats };
  }).map(({ c, mine, stats }) => ({
    id: c.id,
    name: c.first_name,
    facts: mine,
    trophies: trophies(stats).filter((t) => t.got),
    stars: stats.stars,
    progress: mergeProgress(
      savedRows.filter((s) => s.student_id === c.id),
      all
        .filter((l) => l.status !== "cancelled" && l.status !== "scheduled" && l.lesson_students.some((x) => x.student_id === c.id))
        // A child's own topics in a shared lesson (update 0024), otherwise the lesson's.
        .map((l) => {
          const own = l.lesson_students.find((x) => x.student_id === c.id)?.topics;
          return own?.length ? { ...l, topics: own } : l;
        }),
    ),
  }));

  // Hours left and when they run out.
  const packages = (pk ?? []) as { hours: number; price_thb: number | null; start_date: string; paid_on: string | null; hours_used_before?: number | null }[];
  let hours: FamilyPage["hours"] = null;
  if (packages.length) {
    const charged = (l: LessonRow) => l.lesson_students.filter((x) => x.uses_hours).map((x) => x.student_id);
    const hl: HoursLesson[] = allAccount
      .filter((l) => (CHARGED_STATUSES as readonly string[]).includes(l.status))
      .map((l) => ({ id: l.id, start_at: l.start_at, end_at: l.end_at, status: l.status, length_hours: l.length_hours, charged_student_ids: charged(l) }));
    const bal = accountBalance(accountIds, packages, (adj ?? []) as { hours: number }[], hl);
    const toEarn = (l: LessonRow): EarnLesson => ({ id: l.id, start_at: l.start_at, end_at: l.end_at, status: l.status, length_hours: l.length_hours, charged: charged(l) });
    const today = todayKey();
    const past = allAccount.filter((l) => bkkStartOfDay(today).getTime() > new Date(l.start_at).getTime() - 86_400_000).map(toEarn);
    const next = allAccount.filter((l) => l.in_calendar && l.status === "scheduled" && new Date(l.start_at).getTime() > now).map(toEarn);
    const f = forecast(bal.left, accountIds, past, next, today);
    hours = { left: bal.left, bought: bal.bought + bal.adjusted, lessonsLeft: f.lessonsLeft, endDate: bal.left > 0 ? f.endDate : null };
  }
  const unpaid = packages.filter((p) => !p.paid_on && p.price_thb != null && Number(p.price_thb) > 0).map((p) => ({ hours: Number(p.hours), price: Number(p.price_thb) }));

  return {
    accountId: acct.id as string,
    familyName: children.map((c) => c.first_name).join(" & "),
    consented: Boolean(acct.family_consent_at),
    children: childRows,
    upcoming,
    messages,
    work,
    hours,
    unpaid,
    promptpayId: ((settings as { promptpay_id?: string | null } | null)?.promptpay_id ?? null) || null,
  };
}
