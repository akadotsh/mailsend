import { providerResponseError, type EmailProvider } from "../provider.js";
import type { EmailAttachment, EmailMessage, SendResult } from "../types.js";

const POSTMARK_EMAIL_ENDPOINT = "https://api.postmarkapp.com/email";

export type PostmarkTrackLinks = "None" | "HtmlAndText" | "HtmlOnly" | "TextOnly";

export interface PostmarkAttachment extends EmailAttachment {
  contentId?: string;
  contentType?: string;
}

export interface PostmarkEmailMessage extends EmailMessage {
  attachments?: PostmarkAttachment[];
  headers?: Record<string, string>;
  messageStream?: string;
  metadata?: Record<string, string>;
  tag?: string;
  trackLinks?: PostmarkTrackLinks;
  trackOpens?: boolean;
}

export class PostmarkProvider implements EmailProvider {
  readonly name = "postmark";
  private readonly serverToken: string;

  constructor(serverToken: string) {
    if (!serverToken) {
      throw new Error("Postmark server token is required");
    }
    this.serverToken = serverToken;
  }

  async send(message: PostmarkEmailMessage): Promise<SendResult> {
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
        ...(message.tag ? { Tag: message.tag } : {}),
        ...(message.headers
          ? {
              Headers: Object.entries(message.headers).map(([Name, Value]) => ({ Name, Value })),
            }
          : {}),
        ...(message.trackOpens === undefined ? {} : { TrackOpens: message.trackOpens }),
        ...(message.trackLinks ? { TrackLinks: message.trackLinks } : {}),
        ...(message.metadata ? { Metadata: message.metadata } : {}),
        ...(message.messageStream ? { MessageStream: message.messageStream } : {}),
        ...(message.attachments?.length
          ? {
              Attachments: message.attachments.map((attachment) => ({
                Name: attachment.filename,
                Content: attachment.content.toString("base64"),
                ContentType: attachment.contentType ?? "application/octet-stream",
                ...(attachment.contentId ? { ContentID: attachment.contentId } : {}),
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
