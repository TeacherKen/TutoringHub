// Open a message straight in WhatsApp or LINE, ready to send.
export type ChatApp = "whatsapp" | "line" | "wechat" | "other" | null | undefined;

/** WhatsApp wants the number with country code and no "+" (Thai numbers start 66). */
export function waNumber(contact: string | null | undefined): string | null {
  const digits = (contact ?? "").replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0") && digits.length === 10) return `66${digits.slice(1)}`; // Thai mobile
  return digits.length >= 8 ? digits : null;
}

export function chatLink(app: ChatApp, contact: string | null | undefined, text: string): { href: string; label: string } | null {
  const msg = encodeURIComponent(text);
  if (app === "whatsapp" || (!app && waNumber(contact))) {
    const n = waNumber(contact);
    return { href: n ? `https://wa.me/${n}?text=${msg}` : `https://wa.me/?text=${msg}`, label: "Send on WhatsApp" };
  }
  if (app === "line") return { href: `https://line.me/R/share?text=${msg}`, label: "Send on LINE" };
  return null; // WeChat and others: copy and paste
}
