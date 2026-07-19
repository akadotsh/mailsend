import type { EmailMessage, SendResult } from "@/core/types/email";

export const SUPPORTED_PROVIDERS = ["resend", "smtp"] as const;
export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

export interface EmailProvider {
  readonly name: string;

  send(message: EmailMessage): Promise<SendResult>;
}
