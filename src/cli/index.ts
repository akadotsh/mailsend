#!/usr/bin/env node

import "dotenv/config";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { parseArgs } from "node:util";

import { EmailClient } from "@/core/providers/client";
import { SUPPORTED_PROVIDERS, type SupportedProvider } from "@/core/providers/index";
import { MailerSendProvider } from "@/core/providers/mailersend";
import { ResendProvider } from "@/core/providers/resend";
import { SmtpProvider } from "@/core/providers/smtp";
import { KeyStore } from "@/core/secrets/key-store";

import packageMetadata from "../../package.json" with { type: "json" };

const VERSION = packageMetadata.version;
const secretStore = new KeyStore("mailsend");

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

  await secretStore.set(getProviderApiKeyName(provider), apiKey);
}

async function getProviderApiKey(provider: SupportedProvider): Promise<string> {
  const storedApiKey = await secretStore.get(getProviderApiKeyName(provider));
  if (storedApiKey) {
    return storedApiKey;
  }

  throw new Error(
    `No API key configured for ${provider}. Run mailsend --config -p ${provider} --api-key <key>`,
  );
}

async function createEmailClient(provider: SupportedProvider): Promise<EmailClient> {
  switch (provider) {
    case "mailersend":
      return new EmailClient(new MailerSendProvider(await getProviderApiKey(provider)));
    case "resend":
      return new EmailClient(new ResendProvider(await getProviderApiKey(provider)));
    case "smtp":
      return new EmailClient(
        new SmtpProvider({
          host: getRequiredEnvironmentVariable("SMTP_HOST"),
          port: 587,
          secure: false,
          requireTLS: true,
          auth: {
            user: getRequiredEnvironmentVariable("SMTP_USER"),
            pass: getRequiredEnvironmentVariable("SMTP_PASS"),
          },
        }),
      );
  }

  throw new Error("Unsupported provider");
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
      from: { type: "string" },
      to: { type: "string", multiple: true },
      subject: { type: "string" },
      html: { type: "string" },
      attachment: { type: "string", multiple: true },
    },
    allowPositionals: true,
    strict: true,
  });

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

    const emailClient = await createEmailClient(provider);
    const attachments = await Promise.all(
      (values.attachment ?? []).map(async (path) => ({
        filename: basename(path),
        content: await readFile(path),
      })),
    );

    const result = await emailClient.send({
      from: values.from,
      to: values.to,
      subject: values.subject,
      html: values.html,
      ...(attachments.length ? { attachments } : {}),
    });
    console.log(`Email sent with ${result.provider}: ${result.id}`);
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
