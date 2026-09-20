import type { EmailProvider } from "./provider.js";
import { sendWithRetry } from "./provider.js";
import type { EmailMessage, SendResult } from "./types.js";

export interface EmailClientOptions {
  retries?: number;
}

export class EmailClient {
  private readonly provider: EmailProvider;
  private readonly retries: number | undefined;

  constructor(provider: EmailProvider, options: EmailClientOptions = {}) {
    this.provider = provider;
    this.retries = options.retries;
  }

  send(message: EmailMessage): Promise<SendResult> {
    return sendWithRetry(this.provider, message, this.retries);
  }
}
