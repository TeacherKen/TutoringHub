"use client";
import { useEffect, useMemo, useState } from "react";
import generatePayload from "promptpay-qr";
import QRCode from "qrcode";

/** PromptPay QR for an exact amount — the parent scans it in their banking app. */
export function PromptPayQR({ promptpayId, amount, label }: { promptpayId: string; amount: number; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const payload = useMemo(() => {
    try {
      return generatePayload(promptpayId, { amount });
    } catch {
      return null;
    }
  }, [promptpayId, amount]);
  const msg = payload ? null : "This PromptPay number doesn't look right — check it in Settings.";

  useEffect(() => {
    if (!payload) return;
    let alive = true;
    QRCode.toDataURL(payload, { width: 560, margin: 2, errorCorrectionLevel: "M" }).then((url) => alive && setSrc(url));
    return () => {
      alive = false;
    };
  }, [payload]);

  const fileName = `PromptPay-${Math.round(amount)}-baht.png`;
  async function share() {
    if (!src) return;
    try {
      const blob = await (await fetch(src)).blob();
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: label });
        return;
      }
    } catch {
      /* cancelled or not supported — fall back to download */
    }
    const a = document.createElement("a");
    a.href = src;
    a.download = fileName;
    a.click();
  }

  if (msg) return <p className="text-sm text-danger">{msg}</p>;
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-line bg-white p-3 text-center text-black">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`PromptPay QR code for ${Math.round(amount).toLocaleString("en-US")} baht`} className="h-48 w-48" />
      ) : (
        <div className="h-48 w-48 animate-pulse rounded bg-gray-100" />
      )}
      <p className="text-sm font-medium">PromptPay · ฿{Math.round(amount).toLocaleString("en-US")}</p>
      <button type="button" className="btn-secondary min-h-10 text-sm" onClick={share} disabled={!src}>
        Share or save QR picture
      </button>
    </div>
  );
}
