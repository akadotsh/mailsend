import type { EmailProvider } from "./provider.js";
import type { EmailMessage, SendResult } from "./types.js";

export class EmailClient {
  private readonly provider: EmailProvider;

  constructor(provider: EmailProvider) {
    this.provider = provider;
  }

  send(message: EmailMessage): Promise<SendResult> {
    return this.provider.send(message);
  }
}
