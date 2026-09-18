import type { EmailProvider } from "@/provider";
import type { EmailMessage, SendResult } from "@/types";

export class EmailClient {
  private readonly provider: EmailProvider;

  constructor(provider: EmailProvider) {
    this.provider = provider;
  }

  send(message: EmailMessage): Promise<SendResult> {
    return this.provider.send(message);
  }
}
