import type { EmailProvider } from "@/core/providers/index";
import type { EmailMessage, SendResult } from "@/core/types/email";

export class EmailClient {
  private readonly provider: EmailProvider;

  constructor(provider: EmailProvider) {
    this.provider = provider;
  }

  send(message: EmailMessage): Promise<SendResult> {
    return this.provider.send(message);
  }
}
