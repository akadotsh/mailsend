import assert from "node:assert/strict";
import test from "node:test";

import { MockProvider } from "@/providers/mock";

const message = {
  from: "sender@example.com",
  to: "recipient@example.com",
  subject: "Hello",
  text: "Hello from the SDK",
};

void test("records messages and returns deterministic IDs", async () => {
  const provider = new MockProvider({ idPrefix: "test" });

  assert.deepEqual(await provider.send(message), { id: "test-1", provider: "mock" });
  assert.deepEqual(await provider.send({ ...message, subject: "Again" }), {
    id: "test-2",
    provider: "mock",
  });
  assert.equal(provider.messages.length, 2);
  assert.deepEqual(provider.messages[0], message);
});

void test("records failed attempts and rejects with the configured error", async () => {
  const error = new Error("provider unavailable");
  const provider = new MockProvider({ error });

  await assert.rejects(provider.send(message), error);
  assert.deepEqual(provider.messages, [message]);
});

void test("resets recorded messages", async () => {
  const provider = new MockProvider();
  await provider.send(message);

  provider.reset();

  assert.deepEqual(provider.messages, []);
  assert.deepEqual(await provider.send(message), { id: "mock-1", provider: "mock" });
});
