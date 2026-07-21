# Duta

Duta is a command-line tool for sending HTML email through a supported email provider.

## Requirements

- Node.js 20 or later
- pnpm

Install the dependencies, build Duta, and install its executable globally:

```sh
pnpm install
pnpm build
npm install --global .
```

You can now run `duta` from any directory. Rebuild and repeat the global install
after making source changes.

## Supported providers

| Provider | Credentials                                                     | Notes                                                                    |
| -------- | --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `resend` | API key stored in the system keychain                           | Configure the key once with the CLI before sending email.                |
| `smtp`   | `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` environment variables | Uses port `587` with STARTTLS. Variables can be placed in a `.env` file. |

List the providers supported by the installed version:

```sh
duta --list-providers
```

## Configure a provider

### Resend

Save a Resend API key in the operating system's keychain:

```sh
duta --config --provider resend --api-key re_your_api_key
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

Using Resend:

```sh
duta \
  --send-email \
  --provider resend \
  --from sender@example.com \
  --to recipient@example.com \
  --subject "Hello from Duta" \
  --html "<h1>Hello!</h1><p>This email was sent with Duta.</p>"
```

Using SMTP:

```sh
duta \
  --send-email \
  --provider smtp \
  --from sender@example.com \
  --to recipient@example.com \
  --subject "Hello from Duta" \
  --html "<p>This email was sent over SMTP.</p>"
```

Repeat `--to` to send to multiple recipients:

```sh
duta \
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
  duta [options]

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

Run `duta --help` to view this reference in the terminal.

For local development without installing the executable, use
`pnpm cli -- <options>`.
