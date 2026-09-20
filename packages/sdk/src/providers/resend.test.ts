import assert from "node:assert/strict";
import test from "node:test";

import { ResendProvider } from "./resend.js";

void test("sends email through the Resend API", async (context) => {
  context.mock.method(globalThis, "fetch", async (...[_url, init]: Parameters<typeof fetch>) => {
    assert.equal(init?.headers && new Headers(init.headers).get("Authorization"), "Bearer re_test");
    const body = init?.body;
    assert.ok(typeof body === "string");
    assert.deepEqual(JSON.parse(body), {
      from: "sender@example.com",
      to: "recipient@example.com",
      subject: "Hello",
      html: "",
      reply_to: "reply@example.com",
    });
    return Response.json({ id: "message-1" });
  });

  const result = await new ResendProvider("re_test").send({
    from: "sender@example.com",
    to: "recipient@example.com",
    subject: "Hello",
    replyTo: "reply@example.com",
  });

  assert.deepEqual(result, { id: "message-1", provider: "resend" });
});
