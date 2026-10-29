// Reads settings from environment variables (set in Vercel → Settings → Environment Variables).
export { DB_SCHEMA, MATERIALS_BUCKET } from "./constants";

export function supabaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!v) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  return v;
}

export function supabasePublicKey(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!v) throw new Error("Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  return v;
}

/** Server-only secret key. Never import this from a client component. */
export function supabaseSecretKey(): string {
  const v = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!v) throw new Error("Missing SUPABASE_SECRET_KEY");
  return v;
}

export function tutorEmail(): string | null {
  return process.env.TUTOR_EMAIL?.trim().toLowerCase() || null;
}

export function tutorName(): string {
  return process.env.TUTOR_NAME?.trim() || "Mr Ken";
}
