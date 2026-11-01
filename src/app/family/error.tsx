"use client";
import { ErrorScreen } from "@/components/ErrorScreen";

/** For parents: no link into the tutor's app. */
export default function FamilyError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="px-4 py-10">
      <ErrorScreen error={error} retry={retry} home={false} />
    </main>
  );
}
