import type { EmailProvider } from "@/provider";
import type { EmailMessage, SendResult } from "@/types";

interface MailerSendAddress {
  email: string;
  name?: string;
}

const MAILERSEND_EMAIL_ENDPOINT = "https://api.mailersend.com/v1/email";

function parseAddress(address: string): MailerSendAddress {
  const match = address.match(/^\s*(?:"?(.+?)"?\s*)?<([^<>]+)>\s*$/);
  if (!match) {
    return { email: address.trim() };
  }

  const [, name, email] = match;
  return {
    email: email.trim(),
    ...(name ? { name: name.trim() } : {}),
  };
}

function parseAddresses(addresses: string | string[]): MailerSendAddress[] {
  return (Array.isArray(addresses) ? addresses : [addresses]).map(parseAddress);
}

export class MailerSendProvider implements EmailProvider {
  readonly name = "mailersend";

  private readonly apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("MailerSend API key is required");
    }
    this.apiKey = apiKey;
  }

  async send(message: EmailMessage): Promise<SendResult> {
    const response = await fetch(MAILERSEND_EMAIL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: parseAddress(message.from),
        to: parseAddresses(message.to),
        subject: message.subject,
        ...(message.text ? { text: message.text } : {}),
        ...(message.html ? { html: message.html } : {}),
        ...(message.cc?.length ? { cc: parseAddresses(message.cc) } : {}),
        ...(message.bcc?.length ? { bcc: parseAddresses(message.bcc) } : {}),
        ...(message.replyTo ? { reply_to: parseAddress(message.replyTo) } : {}),
        ...(message.attachments?.length
          ? {
              attachments: message.attachments.map((attachment) => ({
                filename: attachment.filename,
                content: attachment.content.toString("base64"),
              })),
            }
          : {}),
      }),
    });

    if (!response.ok) {
      let errorMessage: string | undefined;
      try {
        const error: unknown = await response.json();
        if (
          typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof error.message === "string"
        ) {
          errorMessage = error.message;
        }
      } catch {
        // MailerSend may return an empty or non-JSON response for upstream failures.
      }
      throw new Error(errorMessage ?? `MailerSend request failed with status ${response.status}`);
    }

    const messageId = response.headers.get("x-message-id");
    if (!messageId) {
      throw new Error("MailerSend response did not include a message ID");
    }

    return {
      id: messageId,
      provider: this.name,
    };
  }
}
