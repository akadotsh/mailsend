import assert from "node:assert/strict";
import test from "node:test";

import { EmailClient } from "./client.js";
import type { EmailProvider } from "./provider.js";
import type { EmailMessage } from "./types.js";

void test("delegates a message to the configured provider", async () => {
  const messages: EmailMessage[] = [];
  const provider: EmailProvider = {
    name: "test",
    send(message) {
      messages.push(message);
      return Promise.resolve({ id: "message-1", provider: this.name });
    },
  };
  const client = new EmailClient(provider);
  const message = {
    from: "sender@example.com",
    to: "recipient@example.com",
    subject: "Hello",
    text: "Hello from the SDK",
  };

  const result = await client.send(message);

  assert.deepEqual(messages, [message]);
  assert.deepEqual(result, { id: "message-1", provider: "test" });
});

void test("propagates provider failures to the caller", async () => {
  const provider: EmailProvider = {
    name: "test",
    send() {
      return Promise.reject(new Error("provider unavailable"));
    },
  };

  await assert.rejects(
    new EmailClient(provider).send({
      from: "sender@example.com",
      to: "recipient@example.com",
      subject: "Hello",
      text: "Hello from the SDK",
    }),
    /provider unavailable/,
  );
});
