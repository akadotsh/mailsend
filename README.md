# MailSend

MailSend is a command-line tool for sending HTML email through a supported email provider.

The repository also contains `@akadotsh/mailsend-sdk`, a provider-neutral TypeScript library
used by the CLI and available for applications that need the same email integrations.

## Requirements

- Node.js 20 or later

Install MailSend globally from npm:

```sh
npm install --global @akadotsh/mailsend@beta
```

You can now run `mailsend` from any directory.

## TypeScript SDK

Install the prerelease SDK:

```sh
npm install @akadotsh/mailsend-sdk@beta
```

Create a provider and send a message:

```ts
import { ResendProvider } from "@akadotsh/mailsend-sdk";

const email = new ResendProvider(process.env.RESEND_API_KEY!);

await email.send({
  from: "Acme <hello@example.com>",
  to: "user@example.com",
  subject: "Welcome",
  html: "<h1>Hello!</h1>",
});
```

The SDK exports adapters for Cloudflare Email, MailerSend, Resend, and SMTP, as well as the
`EmailProvider` interface for custom integrations. Credential storage and environment loading are
CLI concerns and are not performed by the SDK.

## Supported providers

| Provider         | Credentials                                                     | Notes                                                                    |
| ---------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Cloudflare Email | API token stored in the system keychain                         | Requires an onboarded domain and an API token with Email Sending: Edit.  |
| `mailersend`     | API key stored in the system keychain                           | The sender must use a domain verified in the user's MailerSend account.  |
| `resend`         | API key stored in the system keychain                           | Configure the key once with the CLI before sending email.                |
| `smtp`           | `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` environment variables | Uses port `587` with STARTTLS. Variables can be placed in a `.env` file. |

List the providers supported by the installed version:

```sh
mailsend --list-providers
```

## Configure a provider

### Cloudflare Email Service

Onboard the sender domain in Cloudflare Email Sending, then save an API token with
the **Email Sending: Edit** permission:

```sh
mailsend --config --provider cloudflare --api-key your_cloudflare_api_token
```

MailSend connects to Cloudflare's SMTP endpoint using implicit TLS. The `--from`
address must use a domain onboarded in the Cloudflare account that owns the token.

### MailerSend

Save a MailerSend API token with Email permission in the operating system's keychain:

```sh
mailsend --config --provider mailersend --api-key mlsn_your_api_token
```

The sender passed to `--from` must use a domain verified in the MailerSend account.
The domain is supplied by the user when sending and is not stored by MailSend.

### Resend

Save a Resend API key in the operating system's keychain:

```sh
mailsend --config --provider resend --api-key re_your_api_key
```

The API key is retrieved from the keychain whenever an email is sent. If it has not
been configured, the send command exits with instructions to configure it.

### SMTP

SMTP credentials are read from environment variables. Create a `.env` file in the
project root:

```dotenv
SMTP_HOST=smtp.example.com
SMTP_USER=your_username
SMTP_PASS=your_password
```

SMTP does not use the `--config` or `--api-key` options.

## Send an email

All of `--provider`, `--from`, `--to`, `--subject`, and `--html` are required.
Use `--attachment <path>` to include a file; repeat the option to include multiple files.

Using Cloudflare Email Service:

```sh
mailsend \
  --send-email \
  --provider cloudflare \
  --from welcome@example.com \
  --to recipient@example.com \
  --subject "Hello from MailSend" \
  --html "<h1>Hello!</h1><p>This email was sent with Cloudflare.</p>"
```

Using MailerSend:

```sh
mailsend \
  --send-email \
  --provider mailersend \
  --from "Acme <sender@example.com>" \
  --to recipient@example.com \
  --subject "Hello from MailSend" \
  --html "<h1>Hello!</h1><p>This email was sent with MailerSend.</p>" \
  --attachment ./test.pdf
```

Using Resend:

```sh
mailsend \
  --send-email \
  --provider resend \
  --from sender@example.com \
  --to recipient@example.com \
  --subject "Hello from MailSend" \
  --html "<h1>Hello!</h1><p>This email was sent with MailSend.</p>"
```

Using SMTP:

```sh
mailsend \
  --send-email \
  --provider smtp \
  --from sender@example.com \
  --to recipient@example.com \
  --subject "Hello from MailSend" \
  --html "<p>This email was sent over SMTP.</p>"
```

Repeat `--to` to send to multiple recipients:

```sh
mailsend \
  --send-email \
  --provider resend \
  --from sender@example.com \
  --to first@example.com \
  --to second@example.com \
  --subject "Hello everyone" \
  --html "<p>Hello!</p>"
```

## Send bulk email

Bulk sending delivers a separate, private message to each row in a CSV file. The CSV must have an
`email` column and may contain additional columns for template fields:

```csv
email,name
alice@example.com,Alice
bob@example.com,Bob
```

Validate the list and options without sending anything:

```sh
mailsend \
  --send-bulk \
  --provider resend \
  --from "Acme <news@example.com>" \
  --recipients ./recipients.csv \
  --subject "Hello {{name}}" \
  --html "<p>Hi {{name}}, welcome!</p>" \
  --dry-run
```

Remove `--dry-run` to send. Bulk sends default to two emails per second; use `--rate` to select a
positive rate up to 10. Use `--report ./bulk-report.json` to save per-recipient results.

Only send bulk email to recipients who explicitly opted in. Configure SPF, DKIM, and DMARC for the
sending domain, include the unsubscribe mechanism required for your type of email, and suppress
unsubscribed, bounced, and complaining recipients before preparing the CSV.

## CLI reference

```text
Usage:
  mailsend [options]

Options:
  -h, --help            Show the help message
  -v, --version         Show the current version
      --list-providers  List available email providers
  -p, --provider        Select an email provider
  -c, --config          Save provider credentials in the system keychain
      --api-key         API key to save with --config
      --send-email      Send an email using the selected provider
      --send-bulk       Send one private email per row in a recipients CSV
      --recipients      CSV file with an email column (required with --send-bulk)
      --rate            Maximum emails per second for bulk sends (default: 2, max: 10)
      --dry-run         Validate and preview a bulk send without sending
      --report          Write the bulk-send result as JSON
      --from            Sender address
      --to              Recipient address (repeat for multiple recipients)
      --subject         Email subject
      --html            Email HTML body
      --attachment      File to attach (repeat for multiple attachments)
```

Run `mailsend --help` to view this reference in the terminal.

## Development

Clone the repository and install its development dependencies with pnpm:

```sh
pnpm install
```

Run the CLI directly from its TypeScript source:

```sh
pnpm cli -- <options>
```

The repository is a pnpm workspace. The independently publishable packages live in
`packages/sdk` and `packages/cli`.

Build the executable package and run all checks:

```sh
pnpm build
pnpm lint
pnpm format:check
```

## License

MailSend is available under the [MIT License](LICENSE).
