#!/usr/bin/env node

import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { parseArgs } from "node:util";

import {
  CloudflareProvider,
  EmailClient,
  MailerSendProvider,
  parseBulkRecipients,
  ResendProvider,
  sendBulkEmails,
  SmtpProvider,
  SUPPORTED_PROVIDERS,
  type EmailProvider,
  type SupportedProvider,
} from "@akadotsh/mailsend-sdk";
import Keytar from "keytar";

import packageMetadata from "../package.json" with { type: "json" };

const VERSION = packageMetadata.version;
const KEYCHAIN_SERVICE = "mailsend";

const HELP_TEXT = `mailsend - send email from the command line

Usage:
  mailsend [options]

Options:
  -h, --help            Show this help message
  -v, --version         Show the current version
      --list-providers  List the available email providers
  -p, --provider        Select an email provider
  -c, --config          Save provider credentials in the system keychain
      --api-key         API key to save with --config
      --send-email      Send an email using the selected provider
      --send-bulk       Send one private email per row in a recipients CSV
      --recipients      CSV file with an email column (required with --send-bulk)
      --rate            Maximum emails per second for bulk sends (default: 2, max: 10)
      --retries         Retries for transient send failures (default: 2, max: 5)
      --dry-run         Validate and preview a bulk send without sending
      --report          Write the bulk-send result as JSON
      --from            Sender address
      --to              Recipient address (repeat for multiple recipients)
      --subject         Email subject
      --html            Email HTML body
      --attachment      File to attach (repeat for multiple attachments)
`;

function isSupportedProvider(provider: string): provider is SupportedProvider {
  return SUPPORTED_PROVIDERS.some((candidate) => candidate === provider);
}

function getProvider(providerOption: string | undefined): SupportedProvider {
  if (!providerOption) {
    throw new Error("A provider must be selected with -p=<provider>");
  }

  const provider = providerOption.startsWith("=") ? providerOption.slice(1) : providerOption;
  if (!isSupportedProvider(provider)) {
    throw new Error(`Unsupported provider: ${provider}`);
  }
  return provider;
}

function getRequiredEnvironmentVariable(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is missing from .env`);
  }
  return value;
}

function getProviderApiKeyName(provider: SupportedProvider): string {
  return `${provider}:api-key`;
}

async function configureProvider(
  provider: SupportedProvider,
  apiKey: string | undefined,
): Promise<void> {
  if (provider === "smtp") {
    throw new Error(`${provider} does not use an API key`);
  }
  if (!apiKey) {
    throw new Error("--api-key is required with --config");
  }

  await Keytar.setPassword(KEYCHAIN_SERVICE, getProviderApiKeyName(provider), apiKey);
}

async function getProviderApiKey(provider: SupportedProvider): Promise<string> {
  const storedApiKey = await Keytar.getPassword(KEYCHAIN_SERVICE, getProviderApiKeyName(provider));
  if (storedApiKey) {
    return storedApiKey;
  }

  throw new Error(
    `No API key configured for ${provider}. Run mailsend --config -p ${provider} --api-key <key>`,
  );
}

async function createEmailProvider(provider: SupportedProvider): Promise<EmailProvider> {
  switch (provider) {
    case "cloudflare":
      return new CloudflareProvider(await getProviderApiKey(provider));
    case "mailersend":
      return new MailerSendProvider(await getProviderApiKey(provider));
    case "resend":
      return new ResendProvider(await getProviderApiKey(provider));
    case "smtp":
      return new SmtpProvider({
        host: getRequiredEnvironmentVariable("SMTP_HOST"),
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
          user: getRequiredEnvironmentVariable("SMTP_USER"),
          pass: getRequiredEnvironmentVariable("SMTP_PASS"),
        },
      });
  }

  throw new Error("Unsupported provider");
}

function getBulkRate(rateOption: string | undefined): number {
  const rate = rateOption === undefined ? 2 : Number(rateOption);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 10) {
    throw new Error("--rate must be a number greater than 0 and no more than 10");
  }
  return rate;
}

function getRetries(retriesOption: string | undefined): number {
  const retries = retriesOption === undefined ? 2 : Number(retriesOption);
  if (!Number.isInteger(retries) || retries < 0 || retries > 5) {
    throw new Error("--retries must be an integer from 0 to 5");
  }
  return retries;
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
      "list-providers": { type: "boolean" },
      provider: { type: "string", short: "p" },
      config: { type: "boolean", short: "c" },
      "api-key": { type: "string" },
      "send-email": { type: "boolean" },
      "send-bulk": { type: "boolean" },
      recipients: { type: "string" },
      rate: { type: "string" },
      retries: { type: "string" },
      "dry-run": { type: "boolean" },
      report: { type: "string" },
      from: { type: "string" },
      to: { type: "string", multiple: true },
      subject: { type: "string" },
      html: { type: "string" },
      attachment: { type: "string", multiple: true },
    },
    allowPositionals: true,
    strict: true,
  });

  if (values["send-email"] && values["send-bulk"]) {
    throw new Error("--send-email and --send-bulk cannot be used together");
  }

  if (values.version) {
    console.log(VERSION);
    return;
  }

  if (values["list-providers"]) {
    console.log(SUPPORTED_PROVIDERS.join("\n"));
    return;
  }

  if (values.config) {
    const provider = getProvider(values.provider);
    await configureProvider(provider, values["api-key"]);
    console.log(`Configured ${provider} credentials in the system keychain`);
    return;
  }

  if (values["send-email"]) {
    const provider = getProvider(values.provider);

    if (!values.from || !values.to?.length || !values.subject || !values.html) {
      throw new Error("--from, --to, --subject, and --html are required to send an email");
    }

    const email = new EmailClient(await createEmailProvider(provider), {
      retries: getRetries(values.retries),
    });
    const attachments = await Promise.all(
      (values.attachment ?? []).map(async (path) => ({
        filename: basename(path),
        content: await readFile(path),
      })),
    );

    const result = await email.send({
      from: values.from,
      to: values.to,
      subject: values.subject,
      html: values.html,
      ...(attachments.length ? { attachments } : {}),
    });
    console.log(`Email sent with ${result.provider}: ${result.id}`);
    return;
  }

  if (values["send-bulk"]) {
    const provider = getProvider(values.provider);
    if (!values.from || !values.subject || !values.html || !values.recipients) {
      throw new Error(
        "--from, --subject, --html, and --recipients are required to send bulk email",
      );
    }
    if (values.to?.length) {
      throw new Error("--to cannot be combined with --send-bulk; use the recipients CSV");
    }
    if (values.attachment?.length) {
      throw new Error("--attachment is not currently supported with --send-bulk");
    }

    const recipients = parseBulkRecipients(await readFile(values.recipients, "utf8"));
    const ratePerSecond = getBulkRate(values.rate);
    const retries = getRetries(values.retries);

    if (values["dry-run"]) {
      console.log(
        `Dry run passed: ${recipients.length} unique recipients, provider ${provider}, rate ${ratePerSecond}/second, retries ${retries}`,
      );
      return;
    }

    const emailProvider = await createEmailProvider(provider);
    console.log(`Sending ${recipients.length} private emails at up to ${ratePerSecond}/second...`);
    const report = await sendBulkEmails({
      sender: emailProvider,
      recipients,
      from: values.from,
      subject: values.subject,
      html: values.html,
      ratePerSecond,
      retries,
    });

    if (values.report) {
      await writeFile(
        values.report,
        `${JSON.stringify({ generatedAt: new Date().toISOString(), provider, ...report }, null, 2)}\n`,
        "utf8",
      );
    }

    console.log(`Bulk send complete: ${report.sent} sent, ${report.failed} failed`);
    for (const failure of report.entries.filter((entry) => entry.status === "failed")) {
      console.error(`Failed ${failure.email}: ${failure.error}`);
    }
    if (report.failed > 0) {
      process.exitCode = 1;
    }
    return;
  }

  if (values.help || positionals.length === 0) {
    console.log(HELP_TEXT);
    return;
  }

  throw new Error(`Unknown command: ${positionals.join(" ")}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
});
