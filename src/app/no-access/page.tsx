import { getMe } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";
import { ThemedGlass } from "@/components/glass/Stadium";

export default async function NoAccess() {
  const me = await getMe();
  return (
    <ThemedGlass>
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
        <div className="glass-hi rounded-[30px] px-7 py-8">
          <h1 className="font-display text-[28px] font-semibold leading-tight">You don&apos;t have access yet</h1>
          <p className="mt-2 text-muted">
            {me ? (
              <>
                You&apos;re signed in as <strong className="text-ink">{me.email}</strong>. Ask Mr Ken to add this email in TutoringHub.
              </>
            ) : (
              "Please sign in first."
            )}
          </p>
          <div className="mt-6">
            <SignOutButton className="btn-secondary w-full" />
          </div>
        </div>
      </main>
    </ThemedGlass>
  );
}
