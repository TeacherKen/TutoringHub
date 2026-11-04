import { getStudents } from "@/lib/data";
import { ArcadeHub } from "@/components/games/Arcade";
import { StadiumGlass } from "@/components/glass/Stadium";

export default async function ArcadePage() {
  const students = await getStudents({ activeOnly: true });
  // The menu is in glass (stadium colours); each game opens in its own unchanged screen.
  return (
    <StadiumGlass>
      <ArcadeHub glass kids={students.map((s) => ({ id: s.id, name: s.first_name.split(" ")[0], onsite: s.mode === "onsite" }))} />
    </StadiumGlass>
  );
}
