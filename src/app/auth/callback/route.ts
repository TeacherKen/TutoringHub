import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NEXT_COOKIE, safeNext } from "@/lib/safeNext";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  // Where to go after signing in (set by the sign-in button), e.g. the games corner. Default: Home.
  let next: string | null = null;
  try {
    next = safeNext(decodeURIComponent(request.cookies.get(NEXT_COOKIE)?.value ?? ""));
  } catch {
    next = null;
  }
  const code = searchParams.get("code");
  let res: NextResponse | null = null;
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) res = NextResponse.redirect(`${origin}${next ?? "/"}`);
  }
  res ??= NextResponse.redirect(`${origin}/login?error=1${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  res.cookies.delete(NEXT_COOKIE);
  return res;
}
