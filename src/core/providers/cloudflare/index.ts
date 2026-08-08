import type { EmailProvider } from "@/core/providers/index";
import { SmtpProvider } from "@/core/providers/smtp";

const CLOUDFLARE_SMTP_HOST = "smtp.mx.cloudflare.net";

export class CloudflareProvider extends SmtpProvider implements EmailProvider {
  readonly name = "cloudflare";

  constructor(apiToken: string) {
    if (!apiToken) {
      throw new Error("Cloudflare API token is required");
    }

    super({
      host: CLOUDFLARE_SMTP_HOST,
      port: 465,
      secure: true,
      auth: {
        user: "api_token",
        pass: apiToken,
      },
    });
  }
}
