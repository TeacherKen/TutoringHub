import { getStudents } from "@/lib/data";
import { ArcadeHub } from "@/components/games/Arcade";

export default async function ArcadePage() {
  const students = await getStudents({ activeOnly: true });
  return <ArcadeHub kids={students.map((s) => ({ id: s.id, name: s.first_name.split(" ")[0], onsite: s.mode === "onsite" }))} />;
}
