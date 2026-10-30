import { NextResponse } from "next/server";
import { getMe } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { BACKUP_BUCKET } from "@/lib/backup";

export const dynamic = "force-dynamic";

/** Tutor only: download one backup file. */
export async function GET(_req: Request, ctx: RouteContext<"/api/backups/[name]">) {
  const me = await getMe();
  if (me?.role !== "tutor") return NextResponse.json({ error: "not allowed" }, { status: 403 });
  const { name } = await ctx.params;
  if (!/^backup-[\d-]+\.json$/.test(name)) return NextResponse.json({ error: "bad name" }, { status: 400 });
  const { data } = await createAdminClient().storage.from(BACKUP_BUCKET).createSignedUrl(name, 60, { download: name });
  if (!data?.signedUrl) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
