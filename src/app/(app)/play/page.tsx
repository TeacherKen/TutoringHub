import type { Metadata } from "next";
import { requireTutor } from "@/lib/auth";
import { getStudents } from "@/lib/data";
import { cleanTables } from "@/lib/facts";
import { PlayHub } from "@/components/games/PlayHub";

export const metadata: Metadata = { title: "Play" };

export default async function PlayPage() {
  await requireTutor();
  const students = await getStudents({ activeOnly: true });
  return (
    <PlayHub
      students={students.map((s) => ({
        id: s.id,
        name: s.first_name,
        token: s.room_token ?? null,
        tables: cleanTables(s.tt_tables ?? []).length ? cleanTables(s.tt_tables) : [2, 3, 4],
        onsite: s.mode === "onsite",
      }))}
    />
  );
}
