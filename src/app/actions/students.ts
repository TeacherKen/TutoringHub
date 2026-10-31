"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertTutor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { syncCalendar } from "@/lib/calendar/sync";
import { assignReceipt } from "@/lib/receipts";

const s = (f: FormData, k: string, max = 500) => {
  const v = String(f.get(k) ?? "").trim();
  return v ? v.slice(0, max) : null;
};

function studentFields(form: FormData) {
  const first = String(form.get("first_name") ?? "").trim().split(/\s+/)[0]?.slice(0, 40) ?? "";
  const keywords = String(form.get("keywords") ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 10);
  const contactApp = s(form, "contact_app", 20);
  return {
    first_name: first,
    level: s(form, "level", 40),
    parent_name: s(form, "parent_name", 80),
    contact_app: ["whatsapp", "line", "wechat", "other"].includes(contactApp ?? "") ? contactApp : null,
    contact: s(form, "contact", 120),
    mode: form.get("mode") === "online" ? "online" : "onsite",
    source: form.get("source") === "preply" ? "preply" : "private",
    place: s(form, "place", 120),
    keywords: keywords.length ? keywords : first ? [first] : [],
    book: s(form, "book", 200),
    private_notes: s(form, "private_notes", 4000),
    active: form.get("active") !== "off",
    updated_at: new Date().toISOString(),
  };
}

export type FormState = { error?: string; ok?: string } | null;

const PAID_BY = ["bank_transfer", "promptpay", "cash", "preply", "other"];

/** Price per class is saved on its own, so saving still works before database update 0013. */
async function saveRate(supabase: Awaited<ReturnType<typeof createClient>>, id: string, form: FormData) {
  if (!form.has("class_price_thb")) return;
  const raw = String(form.get("class_price_thb") ?? "").trim();
  const n = Number(raw);
  const price = raw === "" ? null : Number.isFinite(n) && n >= 0 && n <= 100000 ? Math.round(n * 100) / 100 : undefined;
  if (price === undefined) return;
  await supabase.from("students").update({ class_price_thb: price }).eq("id", id);
}

export async function createStudent(_: FormState, form: FormData): Promise<FormState> {
  await assertTutor();
  const fields = studentFields(form);
  if (!fields.first_name) return { error: "Please enter a first name." };
  const supabase = await createClient();
  const { data: acct, error: aErr } = await supabase
    .from("hour_accounts")
    .insert({ name: fields.first_name })
    .select("id")
    .single();
  if (aErr) return { error: "Couldn't save. Please try again." };
  const { data, error } = await supabase
    .from("students")
    .insert({ ...fields, hour_account_id: acct.id })
    .select("id")
    .single();
  if (error) {
    await supabase.from("hour_accounts").delete().eq("id", acct.id);
    return error.code === "23505"
      ? { error: `You already have a student called ${fields.first_name}. Use a different nickname.` }
      : { error: "Couldn't save. Please try again." };
  }
  await saveRate(supabase, data.id, form);
  await syncCalendar();
  revalidatePath("/", "layout");
  redirect(`/students/${data.id}`);
}

export async function updateStudent(_: FormState, form: FormData): Promise<FormState> {
  await assertTutor();
  const id = String(form.get("id"));
  const fields = studentFields(form);
  if (!fields.first_name) return { error: "Please enter a first name." };
  const supabase = await createClient();
  const { error } = await supabase.from("students").update(fields).eq("id", id);
  if (error) {
    return error.code === "23505"
      ? { error: `You already have a student called ${fields.first_name}.` }
      : { error: "Couldn't save. Please try again." };
  }
  await saveRate(supabase, id, form);
  await syncCalendar();
  revalidatePath("/", "layout");
  return { ok: "Saved." };
}

export async function deleteStudent(form: FormData): Promise<void> {
  await assertTutor();
  const id = String(form.get("id"));
  const supabase = await createClient();
  const { data: st } = await supabase.from("students").select("hour_account_id").eq("id", id).single();
  await supabase.from("students").delete().eq("id", id);
  if (st?.hour_account_id) {
    const { count } = await supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("hour_account_id", st.hour_account_id);
    if (!count) await supabase.from("hour_accounts").delete().eq("id", st.hour_account_id);
  }
  revalidatePath("/", "layout");
  redirect("/students");
}

/** Share package hours with a sibling, or go back to their own hours. */
export async function setHourSharing(form: FormData): Promise<void> {
  await assertTutor();
  const id = String(form.get("id"));
  const withId = String(form.get("share_with") ?? "");
  const supabase = await createClient();
  const { data: me } = await supabase.from("students").select("first_name, hour_account_id").eq("id", id).single();
  if (!me) return;

  if (withId && withId !== "own") {
    const { data: other } = await supabase.from("students").select("hour_account_id").eq("id", withId).single();
    let target = other?.hour_account_id as string | null;
    if (!target) {
      const { data: a } = await supabase.from("hour_accounts").insert({ name: "Shared" }).select("id").single();
      target = a!.id;
      await supabase.from("students").update({ hour_account_id: target }).eq("id", withId);
    }
    const old = me.hour_account_id as string | null;
    await supabase.from("students").update({ hour_account_id: target }).eq("id", id);
    if (old && old !== target) {
      const { count: stillUsed } = await supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("hour_account_id", old);
      if (!stillUsed) {
        // Nobody else uses the old hours: move its packages and adjustments over.
        await supabase.from("packages").update({ hour_account_id: target }).eq("hour_account_id", old);
        await supabase.from("hour_adjustments").update({ hour_account_id: target }).eq("hour_account_id", old);
        await supabase.from("hour_accounts").delete().eq("id", old);
      } else {
        await renameAccount(old);
      }
    }
    await renameAccount(target!);
  } else {
    const old = me.hour_account_id as string | null;
    if (old) {
      const { count } = await supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("hour_account_id", old)
        .neq("id", id);
      if (!count) return; // already has their own hours
    }
    const { data: a } = await supabase.from("hour_accounts").insert({ name: me.first_name }).select("id").single();
    await supabase.from("students").update({ hour_account_id: a!.id }).eq("id", id);
    if (old) await renameAccount(old);
  }
  revalidatePath("/", "layout");
}

async function renameAccount(accountId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("students").select("first_name").eq("hour_account_id", accountId).order("first_name");
  const names = (data ?? []).map((r) => r.first_name as string);
  if (names.length) await supabase.from("hour_accounts").update({ name: names.join(" & ") }).eq("id", accountId);
}

export async function addPackage(_: FormState, form: FormData): Promise<FormState> {
  await assertTutor();
  const hours = Number(form.get("hours"));
  const price = form.get("price_thb") ? Number(form.get("price_thb")) : null;
  const start = String(form.get("start_date") ?? "");
  if (!(hours > 0 && hours <= 500)) return { error: "Hours must be more than 0." };
  if (price != null && !(price >= 0)) return { error: "Price must be a number." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return { error: "Please choose the start date." };
  const unpaid = form.get("payment") === "unpaid";
  const paidBy = String(form.get("paid_by") ?? "");
  const paidOn = String(form.get("paid_on") ?? "");
  const paidOnOk = !unpaid && /^\d{4}-\d{2}-\d{2}$/.test(paidOn) ? paidOn : null;
  const supabase = await createClient();
  const row = {
    hour_account_id: String(form.get("hour_account_id")),
    hours,
    price_thb: price,
    start_date: start,
    paid_on: paidOnOk,
    paid_by: paidOnOk && PAID_BY.includes(paidBy) ? paidBy : null,
    note: s(form, "note", 300),
  };
  let { data, error } = await supabase.from("packages").insert(row).select("id").single();
  if (error && row.paid_by === "promptpay") {
    // Before database update 0012, "PromptPay" isn't allowed yet — save it as bank transfer.
    ({ data, error } = await supabase.from("packages").insert({ ...row, paid_by: "bank_transfer" }).select("id").single());
  }
  if (error || !data) return { error: "Couldn't save the package." };
  const before = Number(form.get("hours_used_before") ?? 0);
  if (before > 0 && before <= hours) await supabase.from("packages").update({ hours_used_before: before }).eq("id", data.id);
  if (paidOnOk) await assignReceipt(supabase, data.id as string, paidOnOk);
  revalidatePath("/", "layout");
  return { ok: unpaid ? "Package added — waiting for payment." : "Package added." };
}

/** A package has been paid: record the date and how, and give it a receipt number. */
export async function markPackagePaid(form: FormData): Promise<void> {
  await assertTutor();
  const id = String(form.get("id") ?? "");
  const paidOn = String(form.get("paid_on") ?? "") || new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
  const paidBy = String(form.get("paid_by") ?? "bank_transfer");
  if (!/^[0-9a-f-]{36}$/.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) return;
  const supabase = await createClient();
  let { error } = await supabase.from("packages").update({ paid_on: paidOn, paid_by: PAID_BY.includes(paidBy) ? paidBy : "other" }).eq("id", id);
  if (error) ({ error } = await supabase.from("packages").update({ paid_on: paidOn, paid_by: "bank_transfer" }).eq("id", id));
  if (!error) await assignReceipt(supabase, id, paidOn);
  revalidatePath("/", "layout");
}

export async function deletePackage(form: FormData): Promise<void> {
  await assertTutor();
  const supabase = await createClient();
  await supabase.from("packages").delete().eq("id", String(form.get("id")));
  revalidatePath("/", "layout");
}

export async function addAdjustment(_: FormState, form: FormData): Promise<FormState> {
  await assertTutor();
  const hours = Number(form.get("hours"));
  const reason = s(form, "reason", 200);
  if (!hours || !Number.isFinite(hours)) return { error: "Enter hours, e.g. 1 or -0.5" };
  if (!reason) return { error: "Please give a reason." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("hour_adjustments")
    .insert({ hour_account_id: String(form.get("hour_account_id")), hours, reason });
  if (error) return { error: "Couldn't save the adjustment." };
  revalidatePath("/", "layout");
  return { ok: "Adjustment saved." };
}

export async function deleteAdjustment(form: FormData): Promise<void> {
  await assertTutor();
  const supabase = await createClient();
  await supabase.from("hour_adjustments").delete().eq("id", String(form.get("id")));
  revalidatePath("/", "layout");
}

/** From a renewal message: add the chosen package now, marked "not paid yet". */
export async function addUnpaidPackage(accountId: string, hours: number, price: number, note: string): Promise<{ ok?: boolean; error?: string }> {
  await assertTutor();
  if (!/^[0-9a-f-]{36}$/.test(accountId) || !(hours > 0 && hours <= 500) || !(price >= 0)) return { error: "Bad package." };
  const supabase = await createClient();
  const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
  const { error } = await supabase
    .from("packages")
    .insert({ hour_account_id: accountId, hours, price_thb: price, start_date: today, paid_on: null, paid_by: null, note: note.slice(0, 300) || null });
  if (error) return { error: "Couldn't add the package." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Which times tables a student practises by default (Football Times Tables). */
export async function setStudentTables(studentId: string, tables: number[]): Promise<{ ok?: boolean; error?: string }> {
  await assertTutor();
  const { cleanTables } = await import("@/lib/facts");
  const clean = cleanTables(tables);
  const supabase = await createClient();
  const { error } = await supabase.from("students").update({ tt_tables: clean.length ? clean : null }).eq("id", studentId);
  if (error) return { error: "Run database update 0016 first." };
  revalidatePath(`/students/${studentId}`);
  return { ok: true };
}
