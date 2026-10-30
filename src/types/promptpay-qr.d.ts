declare module "promptpay-qr" {
  /** Thai PromptPay QR payload for a phone number, 13-digit ID or e-wallet ID. */
  export default function generatePayload(target: string, options?: { amount?: number }): string;
}
