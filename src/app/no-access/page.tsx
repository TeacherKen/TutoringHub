import { getMe } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";

export default async function NoAccess() {
  const me = await getMe();
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="h1">You don&apos;t have access yet</h1>
      <p className="mt-2 text-muted">
        {me ? (
          <>
            You&apos;re signed in as <strong className="text-ink">{me.email}</strong>. Ask Mr Ken to add this email in
            TutoringHub.
          </>
        ) : (
          "Please sign in first."
        )}
      </p>
      <div className="mt-6">
        <SignOutButton className="btn-secondary w-full" />
      </div>
    </main>
  );
}
