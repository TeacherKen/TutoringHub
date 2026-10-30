"use client";
import { chatLink, type ChatApp } from "@/lib/chat";

/** Opens WhatsApp or LINE with the message already typed (the parent's chat, when we know their number). */
export function SendButton({ app, contact, text, className = "btn-primary" }: { app: ChatApp; contact: string | null | undefined; text: string; className?: string }) {
  const link = chatLink(app, contact, text);
  if (!link || !text.trim()) return null;
  return (
    <a href={link.href} target="_blank" rel="noopener noreferrer" className={className}>
      {link.label === "Send on LINE" ? "💬 " : "🟢 "}
      {link.label}
    </a>
  );
}
