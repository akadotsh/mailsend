import assert from "node:assert/strict";
import test from "node:test";

import {
  type BulkSender,
  parseBulkRecipients,
  renderBulkTemplate,
  sendBulkEmails,
} from "./bulk.js";

void test("parses quoted CSV values and renders recipient fields", () => {
  const recipients = parseBulkRecipients(
    'email,name,company\nAlice@Example.com,Alice,"Acme, Inc."\n',
  );

  assert.deepEqual(recipients, [
    {
      email: "alice@example.com",
      fields: { email: "alice@example.com", name: "Alice", company: "Acme, Inc." },
      row: 2,
    },
  ]);
  assert.equal(
    renderBulkTemplate("Hello {{ name }} at {{company}}", recipients[0].fields),
    "Hello Alice at Acme, Inc.",
  );
});

void test("rejects duplicate recipient addresses before sending", () => {
  assert.throws(
    () => parseBulkRecipients("email\nalice@example.com\nALICE@example.com\n"),
    /duplicates alice@example\.com/,
  );
});

void test("sends private messages and reports failures", async () => {
  const recipients = parseBulkRecipients(
    "email,name\nalice@example.com,Alice\nbob@example.com,Bob\n",
  );
  const destinations: Array<string | string[]> = [];
  const sender: BulkSender = {
    send(message) {
      destinations.push(message.to);
      if (message.to === "bob@example.com") {
        return Promise.reject(new Error("provider rejected recipient"));
      }
      return Promise.resolve({ id: "message-1", provider: "test" });
    },
  };

  const report = await sendBulkEmails({
    sender,
    recipients,
    from: "sender@example.com",
    subject: "Hello {{name}}",
    html: "<p>Hello {{name}}</p>",
    ratePerSecond: 10,
  });

  assert.deepEqual(destinations, ["alice@example.com", "bob@example.com"]);
  assert.equal(report.sent, 1);
  assert.equal(report.failed, 1);
  assert.equal(report.entries[1].error, "provider rejected recipient");
});
