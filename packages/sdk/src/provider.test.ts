import assert from "node:assert/strict";
import test from "node:test";

import { providerResponseError, sendWithRetry } from "./provider.js";

void test("retries transient provider failures", async () => {
  let attempts = 0;
  const result = await sendWithRetry(
    {
      send() {
        attempts += 1;
        return attempts < 3
          ? Promise.reject(
              providerResponseError(
                new Response(null, { status: 503, headers: { "retry-after": "0" } }),
                "unavailable",
              ),
            )
          : Promise.resolve({ id: "message-1", provider: "test" });
      },
    },
    { from: "from@example.com", to: "to@example.com", subject: "Hello" },
  );

  assert.equal(attempts, 3);
  assert.deepEqual(result, { id: "message-1", provider: "test" });
});
