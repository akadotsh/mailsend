export { parseBulkRecipients, renderBulkTemplate, sendBulkEmails } from "./bulk.js";
export type { BulkRecipient, BulkSendEntry, BulkSendReport } from "./bulk.js";
export { EmailClient } from "./client.js";
export type { EmailClientOptions } from "./client.js";
export { SUPPORTED_PROVIDERS } from "./provider.js";
export type { EmailProvider, SupportedProvider } from "./provider.js";
export { CloudflareProvider } from "./providers/cloudflare.js";
export { MailerSendProvider } from "./providers/mailersend.js";
export { MockProvider } from "./providers/mock.js";
export type { MockProviderOptions } from "./providers/mock.js";
export { PostmarkProvider } from "./providers/postmark.js";
export type {
  PostmarkAttachment,
  PostmarkEmailMessage,
  PostmarkTrackLinks,
} from "./providers/postmark.js";
export { ResendProvider } from "./providers/resend.js";
export { SmtpProvider } from "./providers/smtp.js";
export type { EmailAttachment, EmailMessage, SendResult, SmtpConfig } from "./types.js";
