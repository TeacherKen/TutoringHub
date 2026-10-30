"use server";
import { revalidatePath } from "next/cache";
import { assertTutor } from "@/lib/auth";
import { makeBackup } from "@/lib/backup";

export async function backupNow(): Promise<{ ok?: string; error?: string }> {
  await assertTutor();
  const r = await makeBackup();
  revalidatePath("/settings");
  return r.ok ? { ok: "Backup saved ✓" } : { error: r.error ?? "Couldn't back up." };
}
