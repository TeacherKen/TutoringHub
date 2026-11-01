"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureRoomToken } from "@/app/actions/rooms";

/** First game for a child without a room link yet: make one, then load their game. */
export function MakeRoomLink({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    void ensureRoomToken(studentId).then((r) => (r.token ? router.refresh() : setFailed(true)));
  }, [studentId, router]);
  return <p className="py-10 text-center text-lg text-white/80">{failed ? "Couldn't open the game. Go back and try again." : "Getting the game ready…"}</p>;
}
