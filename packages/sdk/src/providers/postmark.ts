import { providerResponseError, type EmailProvider } from "../provider.js";
import type { EmailAttachment, EmailMessage, SendResult } from "../types.js";

const POSTMARK_API = "https://api.postmarkapp.com";

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

export type PostmarkTemplateMessage = {
  attachments?: PostmarkAttachment[];
  bcc?: string[];
  cc?: string[];
  from: string;
  headers?: Record<string, string>;
  inlineCss?: boolean;
  messageStream?: string;
  metadata?: Record<string, string>;
  replyTo?: string;
  tag?: string;
  templateModel: Record<string, unknown>;
  to: string | string[];
  trackLinks?: PostmarkTrackLinks;
  trackOpens?: boolean;
} & ({ templateAlias: string; templateId?: never } | { templateAlias?: never; templateId: number });

type PostmarkMessageFields = Pick<
  PostmarkTemplateMessage,
  | "attachments"
  | "bcc"
  | "cc"
  | "from"
  | "headers"
  | "messageStream"
  | "metadata"
  | "replyTo"
  | "tag"
  | "to"
  | "trackLinks"
  | "trackOpens"
>;

function toPostmarkFields(message: PostmarkMessageFields): object {
  return {
    From: message.from,
    To: Array.isArray(message.to) ? message.to.join(",") : message.to,
    ...(message.cc?.length ? { Cc: message.cc.join(",") } : {}),
    ...(message.bcc?.length ? { Bcc: message.bcc.join(",") } : {}),
    ...(message.replyTo ? { ReplyTo: message.replyTo } : {}),
    ...(message.tag ? { Tag: message.tag } : {}),
    ...(message.headers
      ? { Headers: Object.entries(message.headers).map(([Name, Value]) => ({ Name, Value })) }
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
  };
}

function getErrorMessage(result: unknown): string | undefined {
  return typeof result === "object" &&
    result !== null &&
    "Message" in result &&
    typeof result.Message === "string"
    ? result.Message
    : undefined;
}

function toSendResult(result: unknown): SendResult {
  if (
    typeof result !== "object" ||
    result === null ||
    !("MessageID" in result) ||
    typeof result.MessageID !== "string"
  ) {
    throw new Error(getErrorMessage(result) ?? "Postmark response did not include a message ID");
  }
  return { id: result.MessageID, provider: "postmark" };
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
    return toSendResult(
      await this.request("/email", {
        ...toPostmarkFields(message),
        Subject: message.subject,
        ...(message.text ? { TextBody: message.text } : {}),
        ...(message.html ? { HtmlBody: message.html } : {}),
      }),
    );
  }

  async sendWithTemplate(message: PostmarkTemplateMessage): Promise<SendResult> {
    return toSendResult(
      await this.request("/email/withTemplate", {
        ...toPostmarkFields(message),
        ...(message.templateId === undefined
          ? { TemplateAlias: message.templateAlias }
          : { TemplateId: message.templateId }),
        TemplateModel: message.templateModel,
        ...(message.inlineCss === undefined ? {} : { InlineCss: message.inlineCss }),
      }),
    );
  }

  private async request(path: string, body: object): Promise<unknown> {
    const response = await fetch(`${POSTMARK_API}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": this.serverToken,
      },
      body: JSON.stringify(body),
    });

    const result: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      throw providerResponseError(
        response,
        getErrorMessage(result) ?? `Postmark request failed with status ${response.status}`,
      );
    }
    return result;
  }
}
