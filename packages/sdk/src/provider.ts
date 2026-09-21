import { setTimeout as wait } from "node:timers/promises";

import type { EmailMessage, SendResult } from "./types.js";

export const SUPPORTED_PROVIDERS = [
  "cloudflare",
  "mailersend",
  "postmark",
  "resend",
  "smtp",
] as const;
export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

export interface EmailProvider {
  readonly name: string;

  send(message: EmailMessage): Promise<SendResult>;
}

class RetryableError extends Error {
  readonly retryAfterMilliseconds: number | undefined;

  constructor(message: string, retryAfterMilliseconds?: number) {
    super(message);
    this.retryAfterMilliseconds = retryAfterMilliseconds;
  }
}

export function providerResponseError(response: Response, message: string): Error {
  if (response.status !== 408 && response.status !== 429 && response.status < 500) {
    return new Error(message);
  }

  const retryAfter = response.headers.get("retry-after");
  const retryAfterMilliseconds = retryAfter ? Number(retryAfter) * 1_000 : undefined;
  return new RetryableError(
    message,
    Number.isFinite(retryAfterMilliseconds) ? retryAfterMilliseconds : undefined,
  );
}

function isRetryable(error: unknown): boolean {
  if (error instanceof RetryableError || error instanceof TypeError) {
    return true;
  }
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const responseCode = "responseCode" in error ? error.responseCode : undefined;
  if (typeof responseCode === "number" && responseCode >= 400 && responseCode < 500) {
    return true;
  }

  const code = "code" in error ? error.code : undefined;
  return (
    typeof code === "string" &&
    ["ECONNECTION", "ECONNRESET", "EDNS", "ESOCKET", "ETIMEDOUT"].includes(code)
  );
}

export async function sendWithRetry(
  sender: Pick<EmailProvider, "send">,
  message: EmailMessage,
  retries = 2,
): Promise<SendResult> {
  if (!Number.isInteger(retries) || retries < 0 || retries > 5) {
    throw new Error("retries must be an integer from 0 to 5");
  }

  for (let attempt = 0; ; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await sender.send(message);
    } catch (error) {
      if (attempt >= retries || !isRetryable(error)) {
        throw error;
      }
      const delay = error instanceof RetryableError ? error.retryAfterMilliseconds : undefined;
      // eslint-disable-next-line no-await-in-loop
      await wait(delay ?? 500 * 2 ** attempt);
    }
  }
}
