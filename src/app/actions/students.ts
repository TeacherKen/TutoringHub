"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertTutor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { syncCalendar } from "@/lib/calendar/sync";

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
  if (error) return { error: "Couldn't save. Please try again." };
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
  if (error) return { error: "Couldn't save. Please try again." };
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
  const paidBy = String(form.get("paid_by") ?? "");
  const paidOn = String(form.get("paid_on") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.from("packages").insert({
    hour_account_id: String(form.get("hour_account_id")),
    hours,
    price_thb: price,
    start_date: start,
    paid_on: /^\d{4}-\d{2}-\d{2}$/.test(paidOn) ? paidOn : null,
    paid_by: ["bank_transfer", "cash", "preply", "other"].includes(paidBy) ? paidBy : null,
    note: s(form, "note", 300),
  });
  if (error) return { error: "Couldn't save the package." };
  revalidatePath("/", "layout");
  return { ok: "Package added." };
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
