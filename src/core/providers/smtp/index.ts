import Nodemailer, { type Transporter } from "nodemailer";

import type { EmailProvider } from "@/core/providers/index";
import type { EmailMessage, SendResult } from "@/core/types/index";

import type { SmtpConfig } from "./transport";

export class SmtpProvider implements EmailProvider {
  private readonly transporter: Transporter;
  name = "smtp";
  constructor(config: SmtpConfig) {
    this.transporter = Nodemailer.createTransport({
      ...config,
    });
  }

  async send(message: EmailMessage): Promise<SendResult> {
    const info = await this.transporter.sendMail({ ...message });

    return {
      id: info.messageId,
      provider: this.name,
    };
  }
}
