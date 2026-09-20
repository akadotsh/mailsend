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

`EmailClient` retries transient failures twice by default. Pass `{ retries: 0 }` through
`{ retries: 5 }` as its second constructor argument to choose the number of retries.

The package exports `CloudflareProvider`, `MailerSendProvider`, `ResendProvider`, and
`SmtpProvider`. Implement the exported `EmailProvider` interface to add another provider.

Use `MockProvider` in tests without making network requests:

```ts
import { MockProvider } from "@akadotsh/mailsend-sdk";

const provider = new MockProvider();

await provider.send({
  from: "sender@example.com",
  to: "recipient@example.com",
  subject: "Test",
  text: "Hello",
});

expect(provider.messages).toHaveLength(1);
```

Pass `{ error: new Error("unavailable") }` to test failure handling. Call `reset()` between tests
when reusing the same provider.

Requires Node.js 20 or later.
