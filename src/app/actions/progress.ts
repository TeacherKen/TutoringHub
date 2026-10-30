"use server";
import { revalidatePath } from "next/cache";
import { assertTutor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cleanTopic, TOPIC_STATUSES, type TopicStatus } from "@/lib/progress";

const ID_RE = /^[0-9a-f-]{36}$/;

/** Set a topic's status for a student (adds it if new). */
export async function setTopicStatus(studentId: string, name: string, status: TopicStatus): Promise<{ ok?: boolean; error?: string }> {
  await assertTutor();
  const topic = cleanTopic(name);
  if (!ID_RE.test(studentId) || !topic) return { error: "Type a topic first." };
  if (!(TOPIC_STATUSES as readonly string[]).includes(status)) return { error: "Unknown status." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("student_topics")
    .upsert({ student_id: studentId, name: topic, status, updated_at: new Date().toISOString() });
  if (error) return { error: "Couldn't save. Has database update 0008 been run?" };
  revalidatePath(`/students/${studentId}`);
  return { ok: true };
}

/** Remove a topic you added by hand. Topics from lesson notes come back as "Learning". */
export async function removeTopic(studentId: string, name: string): Promise<{ ok?: boolean }> {
  await assertTutor();
  if (!ID_RE.test(studentId)) return {};
  const supabase = await createClient();
  const { error } = await supabase.from("student_topics").delete().eq("student_id", studentId).eq("name", cleanTopic(name));
  revalidatePath(`/students/${studentId}`);
  return { ok: !error };
}
