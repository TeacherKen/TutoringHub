import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArcadeShell } from "@/components/games/Arcade";
import { FootballTables } from "@/components/games/FootballTables";
import { MakeRoomLink } from "@/components/games/MakeRoomLink";

/** ⚽ Football Times Tables for one child on Mr Ken's iPad. Their chart and trophies update as they play. */
export default async function ArcadeFootballPage({ params }: PageProps<"/arcade/football/[studentId]">) {
  const { studentId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(studentId)) notFound();
  const supabase = await createClient();
  const { data: s } = await supabase.from("students").select("id, first_name, room_token").eq("id", studentId).maybeSingle();
  if (!s) notFound();
  const name = String(s.first_name).split(" ")[0];
  return (
    <ArcadeShell back="/arcade" title={`${name}'s football`}>
      <div className="py-2">{s.room_token ? <FootballTables api={`/api/room/${s.room_token}/practice`} /> : <MakeRoomLink studentId={s.id as string} />}</div>
    </ArcadeShell>
  );
}
