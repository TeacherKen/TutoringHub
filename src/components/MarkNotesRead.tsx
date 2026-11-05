"use client";
import { useEffect } from "react";
import { markFamilyNotesRead } from "@/app/actions/family";
import { netFail } from "@/lib/netFail";

/** Opening the messages marks the family's new ones as read (so they leave Home's To do). */
export function MarkNotesRead({ accountId, unread }: { accountId: string; unread: number }) {
  useEffect(() => {
    if (!unread) return;
    const open = () => document.getElementById("messages")?.hasAttribute("open");
    const go = () => {
      if (open()) void markFamilyNotesRead(accountId).catch(netFail);
    };
    go();
    const el = document.getElementById("messages");
    el?.addEventListener("toggle", go);
    return () => el?.removeEventListener("toggle", go);
  }, [accountId, unread]);
  return null;
}
