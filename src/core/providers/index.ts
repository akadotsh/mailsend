import type { EmailMessage, SendResult } from "../types/email";

export interface EmailProvider {
  readonly name: string;

  send(message: EmailMessage): Promise<SendResult>;
}
