import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireTutor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tutorName } from "@/lib/env";
import { cleanWorksheet } from "@/lib/worksheet";
import { WorksheetView } from "@/components/WorksheetView";

export const metadata: Metadata = { title: "Worksheet", robots: { index: false, follow: false } };

/** 📝 A worksheet made by the AI, laid out on A4 to print or save as PDF. */
export default async function WorksheetPage({ params }: PageProps<"/print/worksheet/[id]">) {
  await requireTutor();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("worksheets").select("lesson_id, student_id, content, students(first_name)").eq("id", id).maybeSingle();
  const ws = data ? cleanWorksheet(data.content) : null;
  if (!data || !ws) notFound();
  const student = data.student_id ? { id: data.student_id as string, name: ((data.students as unknown as { first_name?: string } | null)?.first_name ?? "the student").split(" ")[0] } : null;
  return <WorksheetView ws={ws} backHref={data.lesson_id ? `/lessons/${data.lesson_id}` : "/schedule"} tutor={tutorName()} student={student} />;
}
