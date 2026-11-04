import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { isArcade, safeNext } from "@/lib/safeNext";
import { ARCADE_META } from "@/lib/games";
import { GoogleButton } from "./GoogleButton";
import { ThemedGlass } from "@/components/glass/Stadium";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// On the iPad, "Add to Home Screen" is often pressed on this sign-in screen. When it leads to
// the games corner, the icon must be the games corner's, so it opens straight into the games.
export async function generateMetadata({ searchParams }: PageProps<"/login">): Promise<Metadata> {
  const next = safeNext(first((await searchParams).next));
  return isArcade(next) ? ARCADE_META : {};
}
export async function generateViewport({ searchParams }: PageProps<"/login">): Promise<Viewport> {
  return isArcade(safeNext(first((await searchParams).next))) ? { themeColor: "#0b1d42" } : {};
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(first(sp.next));
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (configured) {
    const me = await getMe();
    if (me) redirect(next ?? "/");
  }
  const { error } = sp;

  return (
    <ThemedGlass>
      <main className="page-enter mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
        <div className="glass-hi relative overflow-hidden rounded-[30px] px-7 py-9 sm:px-9">
          <div aria-hidden className="glass-grid" />
          <div className="relative">
            <div className="glass-hi mb-5 grid h-14 w-14 place-items-center rounded-[16px] font-display text-[26px] font-bold text-accent">T</div>
            <h1 className="font-display text-[38px] font-semibold leading-tight tracking-[-0.015em]">TutoringHub</h1>
            <p className="mt-2 text-[var(--th-text-2)]">
              {isArcade(next) ? "Sign in once as Mr Ken. Then the games corner opens, ready for the children." : "Lessons, notes, parent feedback and package hours."}
            </p>
            <div className="mt-7">
              {!configured ? (
                <p className="card text-sm">The app isn&apos;t connected to its database yet. Finish the setup steps first.</p>
              ) : (
                <>
                  <GoogleButton next={next} />
                  {error ? <p className="mt-4 rounded-xl bg-danger-soft p-3 text-sm text-danger">Sign-in didn&apos;t finish. Please try again.</p> : null}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </ThemedGlass>
  );
}
