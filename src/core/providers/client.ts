import type { EmailProvider } from ".";
import type { EmailMessage, SendResult } from "../types/email";

export class EmailClient {
  private readonly provider: EmailProvider;

  constructor(provider: EmailProvider) {
    this.provider = provider;
  }

  send(message: EmailMessage): Promise<SendResult> {
    return this.provider.send(message);
  }
}
