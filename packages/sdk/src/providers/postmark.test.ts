import assert from "node:assert/strict";
import test from "node:test";

import { PostmarkProvider } from "./postmark.js";

void test("sends email through the Postmark API", async (context) => {
  context.mock.method(globalThis, "fetch", async (...[_url, init]: Parameters<typeof fetch>) => {
    assert.equal(
      init?.headers && new Headers(init.headers).get("X-Postmark-Server-Token"),
      "pm_test",
    );
    const body = init?.body;
    assert.ok(typeof body === "string");
    assert.deepEqual(JSON.parse(body), {
      From: "sender@example.com",
      To: "first@example.com,second@example.com",
      Subject: "Hello",
      HtmlBody: "<p>Hello</p>",
      ReplyTo: "reply@example.com",
      Attachments: [
        {
          Name: "hello.txt",
          Content: "aGVsbG8=",
          ContentType: "application/octet-stream",
        },
      ],
    });
    return Response.json({ ErrorCode: 0, Message: "OK", MessageID: "message-1" });
  });

  const result = await new PostmarkProvider("pm_test").send({
    from: "sender@example.com",
    to: ["first@example.com", "second@example.com"],
    subject: "Hello",
    html: "<p>Hello</p>",
    replyTo: "reply@example.com",
    attachments: [{ filename: "hello.txt", content: Buffer.from("hello") }],
  });

  assert.deepEqual(result, { id: "message-1", provider: "postmark" });
});
