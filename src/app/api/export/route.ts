import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMoneyData } from "@/lib/data";
import { bkkDateKey, fmtTime } from "@/lib/time";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { scheduled: "Not marked", done: "Done", cancelled: "Cancelled", cancelled_charged: "Cancelled (charged)", no_show: "No-show" };
const PAID_BY: Record<string, string> = { bank_transfer: "Bank transfer", promptpay: "PromptPay", cash: "Cash", preply: "Preply", other: "Other" };

/** Tutor only: everything in one Excel file (lessons, money, packages, students, topics). */
export async function GET() {
  const me = await getMe();
  if (me?.role !== "tutor") return NextResponse.json({ error: "not allowed" }, { status: 403 });
  const supabase = await createClient();

  type LessonRow = {
    id: string;
    start_at: string;
    status: string;
    length_hours: number | null;
    learned: string | null;
    next_time: string | null;
    homework: string | null;
    topics: string[] | null;
    sent_at: string | null;
    lesson_students: { students: { first_name: string } | null }[];
  };
  const lessons: LessonRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("lessons")
      .select("id, start_at, status, length_hours, learned, next_time, homework, topics, sent_at, lesson_students!inner(students(first_name))")
      .eq("ignored", false)
      .lte("start_at", new Date().toISOString())
      .order("start_at", { ascending: false })
      .range(from, from + 999);
    lessons.push(...((data ?? []) as unknown as LessonRow[]));
    if (!data || data.length < 1000) break;
  }
  const money = await getMoneyData();
  const value = new Map(money.lessons.map((l) => [l.id, l]));
  const [{ data: accounts }, { data: topics }] = await Promise.all([
    supabase.from("hour_accounts").select("id, name"),
    supabase.from("student_topics").select("student_id, name, status, updated_at"),
  ]);
  const accountName = new Map((accounts ?? []).map((a) => [a.id as string, a.name as string]));
  const studentName = new Map(money.students.map((s) => [s.id, s.first_name]));

  const wb = new ExcelJS.Workbook();
  wb.creator = "TutoringHub";
  const sheet = (name: string, columns: { header: string; key: string; width: number }[]) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = columns;
    ws.getRow(1).font = { bold: true };
    return ws;
  };

  const ls = sheet("Lessons", [
    { header: "Date", key: "date", width: 12 },
    { header: "Time", key: "time", width: 8 },
    { header: "Students", key: "students", width: 20 },
    { header: "Status", key: "status", width: 18 },
    { header: "Hours", key: "hours", width: 8 },
    { header: "Earned (฿)", key: "earned", width: 12 },
    { header: "Learned today", key: "learned", width: 50 },
    { header: "Next time", key: "next", width: 40 },
    { header: "Homework", key: "homework", width: 30 },
    { header: "Topics", key: "topics", width: 30 },
    { header: "Feedback sent", key: "sent", width: 13 },
  ]);
  for (const l of lessons) {
    const v = value.get(l.id);
    ls.addRow({
      date: bkkDateKey(l.start_at),
      time: fmtTime(l.start_at),
      students: [...new Set(l.lesson_students.map((x) => x.students?.first_name).filter(Boolean))].join(" & "),
      status: STATUS[l.status] ?? l.status,
      hours: v?.hours ?? (l.length_hours != null ? Number(l.length_hours) : null),
      earned: v?.value ?? null,
      learned: l.learned ?? "",
      next: l.next_time ?? "",
      homework: l.homework ?? "",
      topics: (l.topics ?? []).join(", "),
      sent: l.sent_at ? "Yes" : "",
    });
  }

  const byMonth = new Map<string, { classes: number; hours: number; earned: number }>();
  for (const l of money.lessons) {
    const m = l.date.slice(0, 7);
    const t = byMonth.get(m) ?? { classes: 0, hours: 0, earned: 0 };
    t.classes++;
    t.hours += l.hours;
    t.earned += l.value ?? 0;
    byMonth.set(m, t);
  }
  const ms = sheet("Money by month", [
    { header: "Month", key: "month", width: 10 },
    { header: "Classes", key: "classes", width: 9 },
    { header: "Hours", key: "hours", width: 8 },
    { header: "Earned (฿)", key: "earned", width: 12 },
  ]);
  for (const [month, t] of [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
    ms.addRow({ month, classes: t.classes, hours: Math.round(t.hours * 100) / 100, earned: Math.round(t.earned) });
  }

  const ps = sheet("Packages", [
    { header: "Family", key: "family", width: 20 },
    { header: "Hours", key: "hours", width: 8 },
    { header: "Price (฿)", key: "price", width: 11 },
    { header: "Counts lessons from", key: "start", width: 18 },
    { header: "Paid on", key: "paid", width: 12 },
    { header: "Paid by", key: "by", width: 14 },
    { header: "Receipt", key: "receipt", width: 13 },
    { header: "Hours used before the app", key: "before", width: 14 },
    { header: "Note", key: "note", width: 30 },
  ]);
  for (const p of money.packages as (typeof money.packages[number] & { receipt_no?: string | null })[]) {
    ps.addRow({
      family: accountName.get(p.hour_account_id) ?? "",
      hours: Number(p.hours),
      price: p.price_thb != null ? Number(p.price_thb) : null,
      start: p.start_date,
      paid: p.paid_on ?? "Not paid yet",
      by: p.paid_by ? (PAID_BY[p.paid_by] ?? p.paid_by) : "",
      receipt: p.receipt_no ?? "",
      before: Number((p as { hours_used_before?: number | null }).hours_used_before ?? 0) || null,
      note: p.note ?? "",
    });
  }

  const ss = sheet("Students", [
    { header: "Name", key: "name", width: 14 },
    { header: "Level", key: "level", width: 9 },
    { header: "Parent", key: "parent", width: 18 },
    { header: "Contact", key: "contact", width: 22 },
    { header: "Onsite / online", key: "mode", width: 14 },
    { header: "Private / Preply", key: "source", width: 15 },
    { header: "Price per class (฿)", key: "rate", width: 17 },
    { header: "Book", key: "book", width: 28 },
    { header: "Active", key: "active", width: 8 },
  ]);
  for (const s of money.students) {
    ss.addRow({
      name: s.first_name,
      level: s.level ?? "",
      parent: s.parent_name ?? "",
      contact: [s.contact_app, s.contact].filter(Boolean).join(": "),
      mode: s.mode,
      source: s.source,
      rate: s.class_price_thb != null ? Number(s.class_price_thb) : null,
      book: s.book ?? "",
      active: s.active ? "Yes" : "No",
    });
  }

  const ts = sheet("Topic progress", [
    { header: "Student", key: "student", width: 14 },
    { header: "Topic", key: "topic", width: 30 },
    { header: "Status", key: "status", width: 12 },
    { header: "Updated", key: "updated", width: 12 },
  ]);
  for (const t of (topics ?? []) as { student_id: string; name: string; status: string; updated_at: string }[]) {
    ts.addRow({
      student: studentName.get(t.student_id) ?? "",
      topic: t.name,
      status: t.status === "got_it" ? "Got it" : t.status === "learning" ? "Learning" : "Coming up",
      updated: bkkDateKey(t.updated_at),
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  const name = `TutoringHub-${bkkDateKey(new Date())}.xlsx`;
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
