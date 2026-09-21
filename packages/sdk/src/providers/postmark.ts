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

export interface PostmarkWebhookTriggers {
  Bounce?: { Enabled: boolean; IncludeContent?: boolean };
  Click?: { Enabled: boolean };
  Delivery?: { Enabled: boolean };
  Open?: { Enabled: boolean; PostFirstOpenOnly?: boolean };
  SpamComplaint?: { Enabled: boolean; IncludeContent?: boolean };
  SubscriptionChange?: { Enabled: boolean };
}

export interface PostmarkWebhookRequest {
  HttpAuth?: { Password: string; Username: string };
  HttpHeaders?: Array<{ Name: string; Value: string }>;
  MessageStream: string;
  Triggers: PostmarkWebhookTriggers;
  Url: string;
  Verify?: boolean;
}

export interface PostmarkWebhook extends Omit<PostmarkWebhookRequest, "Verify"> {
  ID: number;
  Status: "unverified" | "verified";
}

export interface PostmarkWebhookVerificationResult {
  Message: string;
  Results: Array<{
    Message: string;
    StatusCode: number;
    Success: boolean;
    TriggerType: string;
  }>;
  Success: boolean;
  Url: string;
  Id: number;
}

export interface PostmarkWebhookStatistics {
  MessageStreamId: string;
  Metrics: Record<string, number | null>;
  MetricsByTrigger: Record<string, Record<string, number | null>>;
  ServerId: number;
  Statuses: Record<string, "unverified" | "verified">;
  TimeRange: { EndTime: string; Hours: number; StartTime: string };
  Url: string;
  WebhookId: number;
}

export interface PostmarkOperationResult {
  ErrorCode: number;
  Message: string;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toWebhookHeader(value: unknown): { Name: string; Value: string } {
  if (!isRecord(value) || typeof value.Name !== "string" || typeof value.Value !== "string") {
    throw new Error("Postmark returned invalid webhook headers");
  }
  return { Name: value.Name, Value: value.Value };
}

function toWebhook(result: unknown): PostmarkWebhook {
  if (
    !isRecord(result) ||
    typeof result.ID !== "number" ||
    typeof result.Url !== "string" ||
    typeof result.MessageStream !== "string" ||
    (result.Status !== "verified" && result.Status !== "unverified") ||
    !isRecord(result.Triggers)
  ) {
    throw new Error("Postmark returned an invalid webhook");
  }
  if (
    result.HttpAuth !== undefined &&
    (!isRecord(result.HttpAuth) ||
      typeof result.HttpAuth.Username !== "string" ||
      typeof result.HttpAuth.Password !== "string")
  ) {
    throw new Error("Postmark returned invalid webhook authentication");
  }
  if (
    result.HttpHeaders !== undefined &&
    (!Array.isArray(result.HttpHeaders) ||
      !result.HttpHeaders.every(
        (header) =>
          isRecord(header) && typeof header.Name === "string" && typeof header.Value === "string",
      ))
  ) {
    throw new Error("Postmark returned invalid webhook headers");
  }
  return {
    ID: result.ID,
    Url: result.Url,
    MessageStream: result.MessageStream,
    Status: result.Status,
    Triggers: result.Triggers,
    ...(isRecord(result.HttpAuth) &&
    typeof result.HttpAuth.Username === "string" &&
    typeof result.HttpAuth.Password === "string"
      ? {
          HttpAuth: {
            Username: result.HttpAuth.Username,
            Password: result.HttpAuth.Password,
          },
        }
      : {}),
    ...(Array.isArray(result.HttpHeaders)
      ? { HttpHeaders: result.HttpHeaders.map(toWebhookHeader) }
      : {}),
  };
}

function toNumberRecord(value: unknown): Record<string, number | null> {
  if (!isRecord(value)) {
    throw new Error("Postmark returned invalid webhook metrics");
  }
  const metrics: Record<string, number | null> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== "number" && item !== null) {
      throw new Error("Postmark returned invalid webhook metrics");
    }
    metrics[key] = item;
  }
  return metrics;
}

function toStatusRecord(value: Record<string, unknown>): Record<string, "unverified" | "verified"> {
  const statuses: Record<string, "unverified" | "verified"> = {};
  for (const [key, status] of Object.entries(value)) {
    if (status !== "verified" && status !== "unverified") {
      throw new Error("Postmark returned invalid webhook statistics");
    }
    statuses[key] = status;
  }
  return statuses;
}

function webhookPath(id: number, suffix = ""): string {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Postmark webhook ID must be a positive integer");
  }
  return `/webhooks/${id}${suffix}`;
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

  async listWebhooks(messageStream?: string): Promise<PostmarkWebhook[]> {
    const query = messageStream ? `?MessageStream=${encodeURIComponent(messageStream)}` : "";
    const result = await this.request(`/webhooks${query}`, undefined, "GET");
    if (!isRecord(result) || !Array.isArray(result.Webhooks)) {
      throw new Error("Postmark returned an invalid webhook list");
    }
    return result.Webhooks.map(toWebhook);
  }

  async getWebhook(id: number): Promise<PostmarkWebhook> {
    return toWebhook(await this.request(webhookPath(id), undefined, "GET"));
  }

  async createWebhook(webhook: PostmarkWebhookRequest): Promise<PostmarkWebhook> {
    return toWebhook(await this.request("/webhooks", webhook));
  }

  async updateWebhook(id: number, webhook: PostmarkWebhookRequest): Promise<PostmarkWebhook> {
    return toWebhook(await this.request(webhookPath(id), webhook, "PUT"));
  }

  async verifyWebhook(id: number): Promise<PostmarkWebhookVerificationResult> {
    const result = await this.request(webhookPath(id, "/verify"), undefined);
    if (
      !isRecord(result) ||
      typeof result.Id !== "number" ||
      typeof result.Url !== "string" ||
      typeof result.Success !== "boolean" ||
      typeof result.Message !== "string" ||
      !Array.isArray(result.Results)
    ) {
      throw new Error("Postmark returned an invalid webhook verification result");
    }
    const results = result.Results.map((entry: unknown) => {
      if (
        !isRecord(entry) ||
        typeof entry.TriggerType !== "string" ||
        typeof entry.Success !== "boolean" ||
        typeof entry.StatusCode !== "number" ||
        typeof entry.Message !== "string"
      ) {
        throw new Error("Postmark returned an invalid webhook verification result");
      }
      return {
        TriggerType: entry.TriggerType,
        Success: entry.Success,
        StatusCode: entry.StatusCode,
        Message: entry.Message,
      };
    });
    return {
      Id: result.Id,
      Url: result.Url,
      Success: result.Success,
      Message: result.Message,
      Results: results,
    };
  }

  async deleteWebhook(id: number): Promise<PostmarkOperationResult> {
    const result = await this.request(webhookPath(id), undefined, "DELETE");
    if (
      !isRecord(result) ||
      typeof result.ErrorCode !== "number" ||
      typeof result.Message !== "string"
    ) {
      throw new Error("Postmark returned an invalid webhook deletion result");
    }
    return { ErrorCode: result.ErrorCode, Message: result.Message };
  }

  async getWebhookStatistics(id: number): Promise<PostmarkWebhookStatistics> {
    const result = await this.request(webhookPath(id, "/statistics"), undefined, "GET");
    if (
      !isRecord(result) ||
      typeof result.WebhookId !== "number" ||
      typeof result.ServerId !== "number" ||
      typeof result.MessageStreamId !== "string" ||
      typeof result.Url !== "string" ||
      !isRecord(result.Statuses) ||
      !isRecord(result.TimeRange) ||
      typeof result.TimeRange.StartTime !== "string" ||
      typeof result.TimeRange.EndTime !== "string" ||
      typeof result.TimeRange.Hours !== "number" ||
      !isRecord(result.MetricsByTrigger)
    ) {
      throw new Error("Postmark returned invalid webhook statistics");
    }
    const metricsByTrigger = Object.fromEntries(
      Object.entries(result.MetricsByTrigger).map(([trigger, metrics]) => [
        trigger,
        toNumberRecord(metrics),
      ]),
    );
    return {
      WebhookId: result.WebhookId,
      ServerId: result.ServerId,
      MessageStreamId: result.MessageStreamId,
      Url: result.Url,
      Statuses: toStatusRecord(result.Statuses),
      TimeRange: {
        StartTime: result.TimeRange.StartTime,
        EndTime: result.TimeRange.EndTime,
        Hours: result.TimeRange.Hours,
      },
      Metrics: toNumberRecord(result.Metrics),
      MetricsByTrigger: metricsByTrigger,
    };
  }

  private async request(
    path: string,
    body?: unknown,
    method: "DELETE" | "GET" | "POST" | "PUT" = "POST",
  ): Promise<unknown> {
    const response = await fetch(`${POSTMARK_API}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        "X-Postmark-Server-Token": this.serverToken,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
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
