import type { EmailMessage, SendResult } from "./types.js";

export const SUPPORTED_PROVIDERS = ["cloudflare", "mailersend", "resend", "smtp"] as const;
export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

export interface EmailProvider {
  readonly name: string;

  send(message: EmailMessage): Promise<SendResult>;
}
