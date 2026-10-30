import type { Metadata } from "next";
import { getFamilyPage } from "@/lib/family";
import { acceptFamilyConsent } from "@/app/actions/family";
import { FamilyView } from "@/components/FamilyView";
import { tutorName } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Maths progress", robots: { index: false, follow: false }, referrer: "no-referrer" };


/** A family's private page: progress, lessons and messages from Mr Ken. No sign-in. */
export default async function FamilyPage({ params }: PageProps<"/family/[token]">) {
  const { token } = await params;
  const f = await getFamilyPage(token);
  const tutor = tutorName();
  if (!f) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 text-center">
        <h1 className="h1">This link doesn&apos;t work</h1>
        <p className="mt-2 text-muted">Please ask {tutor} for a new link.</p>
      </main>
    );
  }

  if (!f.consented) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
        <h1 className="h1">{f.familyName}&apos;s maths with {tutor}</h1>
        <div className="card space-y-3 text-sm">
          <p>This private page shows {f.familyName}&apos;s lesson times, topic progress, messages from {tutor}, and pictures of their work.</p>
          <p className="text-muted">It is only for {f.familyName}&apos;s family. Please don&apos;t forward the link.</p>
          <form action={acceptFamilyConsent} className="space-y-3">
            <input type="hidden" name="token" value={token} />
            <label className="flex items-start gap-3">
              <input type="checkbox" name="agree" required className="mt-1 h-5 w-5 accent-[var(--accent)]" />
              <span>I am {f.familyName}&apos;s parent or guardian, and I&apos;m happy for this information to be shown to me here.</span>
            </label>
            <button className="btn-primary w-full">Continue</button>
          </form>
        </div>
      </main>
    );
  }

  return <FamilyView f={f} tutor={tutor} />;
}
