import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getMe } from "@/lib/auth";
import { refreshedJustNow, syncCalendar, syncIfStale } from "@/lib/calendar/sync";
import { autoMarkDone } from "@/lib/autoDone";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Bring the lessons up to date in the background, after a page has already shown:
 * read the calendars if it's been 10 minutes (or now, for the Refresh button) and mark past
 * classes done. `changed` tells the page to redraw.
 */
export async function POST(req: Request) {
  const me = await getMe();
  if (!me || (me.role !== "tutor" && me.role !== "viewer")) return NextResponse.json({ ok: false, message: "Not allowed." }, { status: 403 });
  const { force } = ((await req.json().catch(() => ({}))) ?? {}) as { force?: unknown };
  let changed = false;
  let message: string | undefined;
  let ok = true;
  if (force === true) {
    if (await refreshedJustNow()) message = "Already up to date.";
    else {
      const r = await syncCalendar();
      ok = r.ok;
      changed = r.ok;
      message = r.ok ? `Updated — ${r.count} calendar events read.` : r.error;
    }
  } else changed = await syncIfStale().catch(() => false);
  if (me.role === "tutor") changed = (await autoMarkDone().catch(() => 0)) > 0 || changed;
  if (changed) revalidatePath("/", "layout");
  return NextResponse.json({ ok, changed, message }, { headers: { "Cache-Control": "no-store" } });
}
