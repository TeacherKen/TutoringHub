"use client";
import { ErrorScreen } from "@/components/ErrorScreen";

export default function KidError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} kid />;
}
