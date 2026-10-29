import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { GoogleButton } from "./GoogleButton";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (configured) {
    const me = await getMe();
    if (me) redirect("/");
  }
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-8">
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-xl font-semibold text-accent-text">
          T
        </div>
        <h1 className="h1">TutoringHub</h1>
        <p className="mt-1 text-muted">Lessons, notes, parent feedback and package hours.</p>
      </div>
      {!configured ? (
        <p className="card text-sm">The app isn&apos;t connected to its database yet. Finish the setup steps first.</p>
      ) : (
        <>
          <GoogleButton />
          {error ? (
            <p className="mt-4 rounded-xl bg-danger-soft p-3 text-sm text-danger">Sign-in didn&apos;t finish. Please try again.</p>
          ) : null}
        </>
      )}
    </main>
  );
}
