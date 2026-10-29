import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="h1">Not found</h1>
      <p className="mt-2 text-muted">This page doesn&apos;t exist, or it was removed.</p>
      <Link href="/" className="btn-secondary mt-6">
        Go home
      </Link>
    </main>
  );
}
