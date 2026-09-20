import { providerResponseError, type EmailProvider } from "../provider.js";
import type { EmailMessage, SendResult } from "../types.js";

const RESEND_EMAIL_ENDPOINT = "https://api.resend.com/emails";

export class ResendProvider implements EmailProvider {
  readonly name = "resend";

  private readonly apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("Resend API key is required");
    }
    this.apiKey = apiKey;
  }

  async send(message: EmailMessage): Promise<SendResult> {
    const response = await fetch(RESEND_EMAIL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...message,
        html: message.html ?? "",
        reply_to: message.replyTo,
        replyTo: undefined,
      }),
    });

    const result: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const errorMessage =
        typeof result === "object" &&
        result !== null &&
        "message" in result &&
        typeof result.message === "string"
          ? result.message
          : `Resend request failed with status ${response.status}`;
      throw providerResponseError(response, errorMessage);
    }
    if (
      typeof result !== "object" ||
      result === null ||
      !("id" in result) ||
      typeof result.id !== "string"
    ) {
      throw new Error("Resend response did not include a message ID");
    }

    return {
      id: result.id,
      provider: this.name,
    };
  }
}
