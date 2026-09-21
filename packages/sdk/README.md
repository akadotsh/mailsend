# `@akadotsh/mailsend-sdk`

A provider-neutral TypeScript SDK for sending email through Cloudflare Email, MailerSend, Postmark,
Resend, or SMTP.

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

The package exports `CloudflareProvider`, `MailerSendProvider`, `PostmarkProvider`,
`ResendProvider`, and `SmtpProvider`. Implement the exported `EmailProvider` interface to add
another provider.

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

## Postmark features

`PostmarkProvider` supports per-message open and link tracking, tags, metadata, custom headers,
message streams, and inline attachments. It also exposes Postmark's template and native batch APIs:

```ts
const postmark = new PostmarkProvider(process.env.POSTMARK_SERVER_TOKEN!);

await postmark.sendWithTemplate({
  from: "hello@example.com",
  to: "user@example.com",
  templateAlias: "welcome",
  templateModel: { name: "Ada" },
  trackOpens: true,
});

await postmark.sendBatch(messages);
await postmark.sendBatchWithTemplates(templateMessages);
```

Webhook management is available through `listWebhooks`, `getWebhook`, `createWebhook`,
`updateWebhook`, `verifyWebhook`, `deleteWebhook`, and `getWebhookStatistics`. Postmark does not
provide HMAC webhook signatures; protect receivers with HTTP Basic Authentication and Postmark IP
allowlisting.
