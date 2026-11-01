"use client";
import { ErrorScreen } from "@/components/ErrorScreen";

export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} />;
}
