# MailSend

MailSend is a command-line tool for sending HTML email through a supported email provider.

## Requirements

- Node.js 20 or later

Install MailSend globally from npm:

```sh
npm install --global @akadotsh/mailsend@beta
```

You can now run `mailsend` from any directory.

## Supported providers

| Provider     | Credentials                                                     | Notes                                                                    |
| ------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `mailersend` | API key stored in the system keychain                           | The sender must use a domain verified in the user's MailerSend account.  |
| `resend`     | API key stored in the system keychain                           | Configure the key once with the CLI before sending email.                |
| `smtp`       | `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` environment variables | Uses port `587` with STARTTLS. Variables can be placed in a `.env` file. |

List the providers supported by the installed version:

```sh
mailsend --list-providers
```

## Configure a provider

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

Using MailerSend:

```sh
mailsend \
  --send-email \
  --provider mailersend \
  --from "Acme <sender@example.com>" \
  --to recipient@example.com \
  --subject "Hello from MailSend" \
  --html "<h1>Hello!</h1><p>This email was sent with MailerSend.</p>"
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
      --from            Sender address
      --to              Recipient address (repeat for multiple recipients)
      --subject         Email subject
      --html            Email HTML body
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

Build the executable package and run all checks:

```sh
pnpm build
pnpm lint
pnpm format:check
```

## License

MailSend is available under the [MIT License](LICENSE).
