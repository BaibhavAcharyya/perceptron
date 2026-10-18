import assert from "node:assert/strict";
import { test } from "node:test";

test("coding agent and Quick Edit routes load without initializing credential-required Firecrawl", async () => {
  delete process.env.FIRECRAWL_API_KEY;
  delete process.env.FIRECRAWL_API_URL;
  delete process.env.PERCEPTRON_WEB_PROVIDER;
  // Only a syntactically valid app URL is needed to construct the existing client.
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Route imports must not make network requests"); };
  try {
    const { processMessage } = await import("../src/features/conversations/inngest/process-message");
    assert.ok(processMessage);
    const { POST } = await import("../src/app/api/quick-edit/route");
    assert.equal(typeof POST, "function");
  } finally { globalThis.fetch = originalFetch; }
});
