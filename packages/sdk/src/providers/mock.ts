import type { EmailProvider } from "@/provider";
import type { EmailMessage, SendResult } from "@/types";

export interface MockProviderOptions {
  error?: Error;
  idPrefix?: string;
}

export class MockProvider implements EmailProvider {
  readonly name = "mock";
  readonly messages: EmailMessage[] = [];

  private readonly error: Error | undefined;
  private readonly idPrefix: string;

  constructor(options: MockProviderOptions = {}) {
    this.error = options.error;
    this.idPrefix = options.idPrefix ?? "mock";
  }

  send(message: EmailMessage): Promise<SendResult> {
    this.messages.push(message);

    if (this.error) {
      return Promise.reject(this.error);
    }

    return Promise.resolve({
      id: `${this.idPrefix}-${this.messages.length}`,
      provider: this.name,
    });
  }

  reset(): void {
    this.messages.length = 0;
  }
}
