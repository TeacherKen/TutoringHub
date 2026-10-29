import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { tutorEmail } from "@/lib/env";

export type Role = "tutor" | "viewer" | "parent" | "student";
export type Me = { email: string; role: Role | null };

/** Who is signed in, and their role (checked against the server, not just the cookie). */
export const getMe = cache(async (): Promise<Me | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = (data?.claims?.email as string | undefined)?.toLowerCase();
  if (!email) return null;
  // Only Google sign-ins are trusted (the database checks this too).
  const provider = (data?.claims?.app_metadata as { provider?: string } | undefined)?.provider;
  if (provider !== "google") return { email, role: null };

  const { data: row } = await supabase.from("app_users").select("role").eq("email", email).maybeSingle();
  let role = (row?.role as Role | undefined) ?? null;

  // First sign-in by the tutor named in TUTOR_EMAIL: give tutor access.
  if (!role && email === tutorEmail()) {
    const admin = createAdminClient();
    await admin.from("app_users").upsert({ email, role: "tutor" }, { onConflict: "email" });
    role = "tutor";
  }
  return { email, role };
});

export async function requireSignedIn(): Promise<Me> {
  const me = await getMe();
  if (!me) redirect("/login");
  if (!me.role || me.role === "parent" || me.role === "student") redirect("/no-access");
  return me;
}

export async function requireTutor(): Promise<Me> {
  const me = await requireSignedIn();
  if (me.role !== "tutor") redirect("/schedule");
  return me;
}

/** For server actions: throws instead of redirecting. */
export async function assertTutor(): Promise<Me> {
  const me = await getMe();
  if (!me || me.role !== "tutor") throw new Error("Only the tutor can do this.");
  return me;
}
