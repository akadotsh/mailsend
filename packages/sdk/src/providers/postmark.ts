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

export interface PostmarkBatchResult {
  errorCode: number;
  id?: string;
  message: string;
  submittedAt?: string;
  to?: string;
}

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

function toPostmarkEmail(message: PostmarkEmailMessage): object {
  return {
    ...toPostmarkFields(message),
    Subject: message.subject,
    ...(message.text ? { TextBody: message.text } : {}),
    ...(message.html ? { HtmlBody: message.html } : {}),
  };
}

function toPostmarkTemplate(message: PostmarkTemplateMessage): object {
  return {
    ...toPostmarkFields(message),
    ...(message.templateId === undefined
      ? { TemplateAlias: message.templateAlias }
      : { TemplateId: message.templateId }),
    TemplateModel: message.templateModel,
    ...(message.inlineCss === undefined ? {} : { InlineCss: message.inlineCss }),
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

function toBatchResults(result: unknown): PostmarkBatchResult[] {
  if (!Array.isArray(result)) {
    throw new Error("Postmark batch response was not an array");
  }
  return result.map((entry: unknown) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("ErrorCode" in entry) ||
      typeof entry.ErrorCode !== "number" ||
      !("Message" in entry) ||
      typeof entry.Message !== "string"
    ) {
      throw new Error("Postmark batch response contained an invalid result");
    }
    return {
      errorCode: entry.ErrorCode,
      message: entry.Message,
      ...("MessageID" in entry && typeof entry.MessageID === "string"
        ? { id: entry.MessageID }
        : {}),
      ...("SubmittedAt" in entry && typeof entry.SubmittedAt === "string"
        ? { submittedAt: entry.SubmittedAt }
        : {}),
      ...("To" in entry && typeof entry.To === "string" ? { to: entry.To } : {}),
    };
  });
}

function checkBatchSize(messages: readonly unknown[]): void {
  if (messages.length === 0 || messages.length > 500) {
    throw new Error("Postmark batches must contain 1 to 500 messages");
  }
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
    return toSendResult(await this.request("/email", toPostmarkEmail(message)));
  }

  async sendWithTemplate(message: PostmarkTemplateMessage): Promise<SendResult> {
    return toSendResult(await this.request("/email/withTemplate", toPostmarkTemplate(message)));
  }

  async sendBatch(messages: PostmarkEmailMessage[]): Promise<PostmarkBatchResult[]> {
    checkBatchSize(messages);
    return toBatchResults(
      await this.request(
        "/email/batch",
        messages.map((message) => toPostmarkEmail(message)),
      ),
    );
  }

  async sendBatchWithTemplates(
    messages: PostmarkTemplateMessage[],
  ): Promise<PostmarkBatchResult[]> {
    checkBatchSize(messages);
    return toBatchResults(
      await this.request("/email/batchWithTemplates", {
        Messages: messages.map((message) => toPostmarkTemplate(message)),
      }),
    );
  }

  private async request(path: string, body: unknown): Promise<unknown> {
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
