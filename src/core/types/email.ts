export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export interface EmailMessage {
  from: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;

  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface SendResult {
  id: string;
  provider: string;
}
