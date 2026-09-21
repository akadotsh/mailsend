import assert from "node:assert/strict";
import test from "node:test";

import { PostmarkProvider } from "./postmark.js";

void test("sends email through the Postmark API", async (context) => {
  context.mock.method(globalThis, "fetch", async (...[url, init]: Parameters<typeof fetch>) => {
    assert.equal(url, "https://api.postmarkapp.com/email");
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
      Tag: "welcome",
      Headers: [{ Name: "X-Campaign", Value: "onboarding" }],
      TrackOpens: true,
      TrackLinks: "HtmlOnly",
      Metadata: { customer: "123" },
      MessageStream: "outbound",
      Attachments: [
        {
          Name: "hello.txt",
          Content: "aGVsbG8=",
          ContentType: "text/plain",
          ContentID: "hello",
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
    tag: "welcome",
    headers: { "X-Campaign": "onboarding" },
    trackOpens: true,
    trackLinks: "HtmlOnly",
    metadata: { customer: "123" },
    messageStream: "outbound",
    attachments: [
      {
        filename: "hello.txt",
        content: Buffer.from("hello"),
        contentType: "text/plain",
        contentId: "hello",
      },
    ],
  });

  assert.deepEqual(result, { id: "message-1", provider: "postmark" });
});

void test("sends email with a Postmark template", async (context) => {
  context.mock.method(globalThis, "fetch", async (...[url, init]: Parameters<typeof fetch>) => {
    assert.equal(url, "https://api.postmarkapp.com/email/withTemplate");
    const body = init?.body;
    assert.ok(typeof body === "string");
    assert.deepEqual(JSON.parse(body), {
      From: "sender@example.com",
      To: "recipient@example.com",
      MessageStream: "outbound",
      TemplateAlias: "welcome",
      TemplateModel: { name: "Ada" },
      InlineCss: true,
    });
    return Response.json({ ErrorCode: 0, Message: "OK", MessageID: "template-1" });
  });

  const result = await new PostmarkProvider("pm_test").sendWithTemplate({
    from: "sender@example.com",
    to: "recipient@example.com",
    templateAlias: "welcome",
    templateModel: { name: "Ada" },
    messageStream: "outbound",
    inlineCss: true,
  });

  assert.deepEqual(result, { id: "template-1", provider: "postmark" });
});

void test("sends Postmark batches and preserves per-message results", async (context) => {
  context.mock.method(globalThis, "fetch", async (...[url, init]: Parameters<typeof fetch>) => {
    const body = init?.body;
    assert.ok(typeof body === "string");
    if (url === "https://api.postmarkapp.com/email/batch") {
      assert.equal(Array.isArray(JSON.parse(body)), true);
      return Response.json([
        {
          ErrorCode: 0,
          Message: "OK",
          MessageID: "batch-1",
          SubmittedAt: "2026-09-21T00:00:00Z",
          To: "first@example.com",
        },
        { ErrorCode: 406, Message: "Inactive recipient", To: "second@example.com" },
      ]);
    }
    assert.equal(url, "https://api.postmarkapp.com/email/batchWithTemplates");
    assert.deepEqual(JSON.parse(body), {
      Messages: [
        {
          From: "sender@example.com",
          To: "first@example.com",
          TemplateId: 42,
          TemplateModel: { name: "Ada" },
        },
      ],
    });
    return Response.json([{ ErrorCode: 0, Message: "OK", MessageID: "template-batch-1" }]);
  });

  const provider = new PostmarkProvider("pm_test");
  const results = await provider.sendBatch([
    {
      from: "sender@example.com",
      to: "first@example.com",
      subject: "Hello",
      text: "Hello",
    },
    {
      from: "sender@example.com",
      to: "second@example.com",
      subject: "Hello",
      text: "Hello",
    },
  ]);
  assert.deepEqual(results, [
    {
      errorCode: 0,
      id: "batch-1",
      message: "OK",
      submittedAt: "2026-09-21T00:00:00Z",
      to: "first@example.com",
    },
    { errorCode: 406, message: "Inactive recipient", to: "second@example.com" },
  ]);

  const templateResults = await provider.sendBatchWithTemplates([
    {
      from: "sender@example.com",
      to: "first@example.com",
      templateId: 42,
      templateModel: { name: "Ada" },
    },
  ]);
  assert.deepEqual(templateResults, [{ errorCode: 0, id: "template-batch-1", message: "OK" }]);
});
