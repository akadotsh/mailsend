import { providerResponseError, type EmailProvider } from "../provider.js";
import type { EmailMessage, SendResult } from "../types.js";

const POSTMARK_EMAIL_ENDPOINT = "https://api.postmarkapp.com/email";

export class PostmarkProvider implements EmailProvider {
  readonly name = "postmark";
  private readonly serverToken: string;

  constructor(serverToken: string) {
    if (!serverToken) {
      throw new Error("Postmark server token is required");
    }
    this.serverToken = serverToken;
  }

  async send(message: EmailMessage): Promise<SendResult> {
    const response = await fetch(POSTMARK_EMAIL_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": this.serverToken,
      },
      body: JSON.stringify({
        From: message.from,
        To: Array.isArray(message.to) ? message.to.join(",") : message.to,
        Subject: message.subject,
        ...(message.text ? { TextBody: message.text } : {}),
        ...(message.html ? { HtmlBody: message.html } : {}),
        ...(message.cc?.length ? { Cc: message.cc.join(",") } : {}),
        ...(message.bcc?.length ? { Bcc: message.bcc.join(",") } : {}),
        ...(message.replyTo ? { ReplyTo: message.replyTo } : {}),
        ...(message.attachments?.length
          ? {
              Attachments: message.attachments.map((attachment) => ({
                Name: attachment.filename,
                Content: attachment.content.toString("base64"),
                ContentType: "application/octet-stream",
              })),
            }
          : {}),
      }),
    });

    const result: unknown = await response.json().catch(() => undefined);
    const errorMessage =
      typeof result === "object" &&
      result !== null &&
      "Message" in result &&
      typeof result.Message === "string"
        ? result.Message
        : undefined;
    if (!response.ok) {
      throw providerResponseError(
        response,
        errorMessage ?? `Postmark request failed with status ${response.status}`,
      );
    }
    if (
      typeof result !== "object" ||
      result === null ||
      !("MessageID" in result) ||
      typeof result.MessageID !== "string"
    ) {
      throw new Error(errorMessage ?? "Postmark response did not include a message ID");
    }

    return { id: result.MessageID, provider: this.name };
  }
}
