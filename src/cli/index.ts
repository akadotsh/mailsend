#!/usr/bin/env node

import { parseArgs } from "node:util";
import { SUPPORTED_PROVIDERS, type SupportedProvider } from "../core/providers";
import { EmailClient } from "../core/providers/client";
import { ResendProvider } from "../core/providers/resend";
import "dotenv/config";

const VERSION = "0.0.0";

const HELP_TEXT = `duta - send email from the command line

Usage:
  duta [options]

Options:
  -h, --help            Show this help message
  -v, --version         Show the current version
      --list-providers  List the available email providers
  -p, --provider        Select an email provider
      --send-email      Send an email using the selected provider
      --from            Sender address
      --to              Recipient address (repeat for multiple recipients)
      --subject         Email subject
      --html            Email HTML body
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

function getProviderApiKey(provider: SupportedProvider): string {
  let apiKey: string | undefined;
  switch (provider) {
    case "resend":
      apiKey = process.env.RESEND_API_KEY;
      break;
  }

  if (!apiKey) {
    throw new Error(`API key for ${provider} is missing from .env`);
  }
  return apiKey;
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
      "list-providers": { type: "boolean" },
      provider: { type: "string", short: "p" },
      "send-email": { type: "boolean" },
      from: { type: "string" },
      to: { type: "string", multiple: true },
      subject: { type: "string" },
      html: { type: "string" },
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

  if (values["send-email"]) {
    const provider = getProvider(values.provider);

    if (!values.from || !values.to?.length || !values.subject || !values.html) {
      throw new Error("--from, --to, --subject, and --html are required to send an email");
    }

    const apiKey = getProviderApiKey(provider);
    let emailClient: EmailClient;
    switch (provider) {
      case "resend":
        emailClient = new EmailClient(new ResendProvider(apiKey));
        break;
    }

    const result = await emailClient.send({
      from: values.from,
      to: values.to,
      subject: values.subject,
      html: values.html,
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
