import { Resend } from "resend";

import type { EmailProvider } from "@/core/providers/index";
import type { EmailMessage, SendResult } from "@/core/types/email";

export class ResendProvider implements EmailProvider {
  readonly name = "resend";

  private readonly client: Resend;
  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("Resend API key is required");
    }
    this.client = new Resend(apiKey);
  }

  async send(message: EmailMessage): Promise<SendResult> {
    const { data, error } = await this.client.emails.send({
      ...message,
      html: message.html ?? "",
    });

    if (error) {
      throw new Error(error.message);
    }

    return {
      id: data.id,
      provider: this.name,
    };
  }
}
