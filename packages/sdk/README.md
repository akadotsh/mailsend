# `@akadotsh/mailsend-sdk`

A provider-neutral TypeScript SDK for sending email through Cloudflare Email, MailerSend, Resend,
or SMTP.

```sh
npm install @akadotsh/mailsend-sdk@beta
```

```ts
import { EmailClient, ResendProvider } from "@akadotsh/mailsend-sdk";

const email = new EmailClient(new ResendProvider(process.env.RESEND_API_KEY!));

await email.send({
  from: "Acme <hello@example.com>",
  to: "user@example.com",
  subject: "Welcome",
  html: "<h1>Hello!</h1>",
});
```

The package exports `CloudflareProvider`, `MailerSendProvider`, `ResendProvider`, and
`SmtpProvider`. Implement the exported `EmailProvider` interface to add another provider.

Requires Node.js 20 or later.
