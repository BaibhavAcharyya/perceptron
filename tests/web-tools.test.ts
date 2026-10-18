import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { createAgent, createNetwork, gemini, type Tool } from "@inngest/agent-kit";
import { createWebTools, resolveWebProvider } from "../src/features/conversations/inngest/tools/web-tools";
import { PARALLEL_MCP_URL, WEB_USER_AGENT, type WebContext } from "../src/lib/parallel-search";

const context: WebContext = { sessionId: "a".repeat(64), modelName: "gemini-2.5-flash" };
const search = { objective: "Find Next.js routing documentation", search_queries: ["Next.js app router documentation"] };
const pageUrl = "https://nextjs.org/docs/app";
const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
type RequestRecord = { method: string; params?: { name?: string; arguments?: Record<string, unknown> } };
let requests: RequestRecord[];
let failure: "none" | "tool" | "http" | "malformed" | "hang" | "permission" | "discovery" | "empty";
let modelTurn: number;

beforeEach(() => {
  delete process.env.FIRECRAWL_API_KEY;
  delete process.env.FIRECRAWL_API_URL;
  delete process.env.PERCEPTRON_WEB_PROVIDER;
  requests = [];
  failure = "none";
  modelTurn = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith("https://generativelanguage.googleapis.com/")) {
      const body = String(init?.body);
      if (modelTurn === 1) assert.match(body, /routing excerpt/);
      if (modelTurn === 2) assert.match(body, /page excerpt/);
      const parts = modelTurn++ === 0
        ? [{ functionCall: { name: "searchWeb", args: search } }]
        : modelTurn === 2
          ? [{ functionCall: { name: "scrapeUrls", args: { urls: [pageUrl] } } }]
          : [{ text: `Use the app router: ${pageUrl}` }];
      return Response.json({ candidates: [{ content: { role: "model", parts }, finishReason: "STOP" }] });
    }
    assert.equal(url, PARALLEL_MCP_URL);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("user-agent"), WEB_USER_AGENT);
    assert.equal(headers.has("authorization"), false);
    if (init?.method === "GET") return new Response(null, { status: 405 });
    if (init?.method === "DELETE") return new Response(null, { status: 200 });
    const body = JSON.parse(String(init?.body));
    requests.push(body);
    if (!("id" in body)) return new Response(null, { status: 202 });
    if (body.method === "tools/call") {
      assert.equal(body.params.arguments.session_id, context.sessionId);
      assert.equal(body.params.arguments.model_name, context.modelName);
      if (failure === "permission") return new Response("forbidden", { status: 403 });
      if (failure === "http") return new Response("unavailable", { status: 503 });
      if (failure === "malformed") return new Response("{oops", { headers: { "content-type": "application/json" } });
      if (failure === "hang") return new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) reject(signal.reason);
        else signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    }
    const result = body.method === "initialize"
      ? { protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "fixture", version: "1" } }
      : body.method === "tools/list"
        ? { tools: (failure === "discovery" ? [] : ["web_search", "web_fetch"]).map((name) => ({ name, inputSchema: { type: "object" } })) }
        : { isError: failure === "tool", content: [{ type: "text", text: failure === "empty" ? "" : failure === "tool" ? "quota exceeded" : JSON.stringify({ results: [{ url: pageUrl, excerpts: [body.params.name === "web_search" ? "routing excerpt" : "page excerpt"] }] }) }] };
    return Response.json({ jsonrpc: "2.0", id: body.id, result });
  };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...savedEnv };
});

async function runTool(name: string, input: unknown, options = context, durable = false) {
  const tools = await createWebTools(options);
  const tool = tools.find((tool) => tool.name === name)! as Tool.Any;
  const agent = createAgent({ name: "test", system: "test", tools });
  const network = createNetwork({ name: "test", agents: [agent], maxIter: 1 });
  const opts = { agent, network } as unknown as Parameters<typeof tool.handler>[1];
  if (durable) opts.step = { run: async (_id: string, fn: () => Promise<unknown>) => fn() } as unknown as typeof opts.step;
  return tool.handler(input, opts);
}

test("unconfigured registry drives a scripted Gemini agent through search, fetch and final result consumption", async () => {
  // Scripted inference responses, with real Agent Kit dispatch and MCP SDK execution.
  const tools = await createWebTools(context);
  assert.deepEqual(tools.map((tool) => tool.name), ["searchWeb", "scrapeUrls"]);
  const agent = createAgent({ name: "perceptron", system: "Find documentation and cite sources", tools,
    model: gemini({ apiKey: "fixture-only", model: context.modelName }) });
  const network = createNetwork({ name: "perceptron-network", agents: [agent], maxIter: 4,
    router: ({ network }) => network.state.results.at(-1)?.output.some((m) => m.type === "text" && m.role === "assistant") ? undefined : agent });
  const result = await network.run("Find Next.js routing docs and read the first page");
  const final = result.state.results.at(-1)?.output.find((m) => m.type === "text");
  assert.ok(final && final.type === "text");
  assert.match(String(final.content), /https:\/\/nextjs.org\/docs\/app/);
  assert.equal(modelTurn, 3);
  assert.deepEqual(requests.filter((r) => r.method === "tools/call").map((r) => r.params?.name), ["web_search", "web_fetch"]);
  assert.equal(requests.filter((r) => r.method === "tools/list").length, 2);
});

test("provider resolution preserves configured credentials, explicit overrides and disable", async () => {
  assert.equal(resolveWebProvider({}), "parallel");
  assert.equal(resolveWebProvider({ FIRECRAWL_API_KEY: "configured" }), "firecrawl");
  assert.equal(resolveWebProvider({ FIRECRAWL_API_URL: "http://localhost:3002" }), "firecrawl");
  assert.equal(resolveWebProvider({ PERCEPTRON_WEB_PROVIDER: "firecrawl", FIRECRAWL_API_URL: "http://localhost:3002" }), "firecrawl");
  assert.equal(resolveWebProvider({ FIRECRAWL_API_KEY: "configured", PERCEPTRON_WEB_PROVIDER: "parallel" }), "parallel");
  process.env.PERCEPTRON_WEB_PROVIDER = "disabled";
  process.env.FIRECRAWL_API_KEY = "configured";
  assert.deepEqual(await createWebTools(context), []);
  assert.equal(requests.length, 0);
  assert.throws(() => resolveWebProvider({ PERCEPTRON_WEB_PROVIDER: "firecrawl" }), /Configure FIRECRAWL/);
  assert.throws(() => resolveWebProvider({ PERCEPTRON_WEB_PROVIDER: "typo" }), /Unknown/);
  process.env.PERCEPTRON_WEB_PROVIDER = "firecrawl";
  assert.deepEqual((await createWebTools(context)).map((t) => t.name), ["scrapeUrls"]);
});

test("configured Firecrawl failure never calls Parallel", async () => {
  process.env.FIRECRAWL_API_KEY = "configured";
  globalThis.fetch = async (input) => {
    assert.ok(!String(input).includes("search.parallel.ai"));
    throw new Error("Firecrawl unavailable");
  };
  assert.match(String(await runTool("scrapeUrls", { urls: [pageUrl] }, context, true)), /Failed to scrape/);
  assert.equal(requests.length, 0);
});

test("durable execution returns useful output and the exact URL to the model", async () => {
  assert.match(String(await runTool("scrapeUrls", { urls: [pageUrl] }, context, true)), /page excerpt/);
  assert.deepEqual(requests.find((r) => r.method === "tools/call")?.params?.arguments?.urls, [pageUrl]);
});

test("bad URLs, embedded credentials, empty queries and oversized batches do not make requests", async () => {
  for (const urls of [["file:///etc/passwd"], ["ftp://example.com"], ["https://user:secret@example.com"], [], Array(21).fill(pageUrl)]) {
    assert.match(String(await runTool("scrapeUrls", { urls })), /^Error:/);
  }
  assert.match(String(await runTool("searchWeb", { objective: "", search_queries: [] })), /^Error:/);
  assert.equal(requests.length, 0);
});

for (const mode of ["tool", "http", "malformed", "permission", "empty"] as const) {
  test(`MCP ${mode} failures become tool errors without a provider fallback`, async () => {
    failure = mode;
    assert.match(String(await runTool("searchWeb", search)), /^Error searching web:/);
    assert.equal(requests.filter((r) => r.method === "tools/call").length, 1);
  });
}

test("timeout and cancellation abort the actual MCP fetch", async () => {
  failure = "hang";
  // Keep the test event loop active while AbortSignal.timeout's unref timer runs.
  const keepAlive = setInterval(() => {}, 1000);
  try {
    assert.match(String(await runTool("searchWeb", search, { ...context, timeoutMs: 25 })), /^Error searching web:/);
    const controller = new AbortController();
    setTimeout(() => controller.abort(new Error("cancelled")), 25);
    assert.match(String(await runTool("searchWeb", search, { ...context, signal: controller.signal })), /cancelled/);
    controller.abort();
    const count = requests.length;
    assert.match(String(await runTool("searchWeb", search, { ...context, signal: controller.signal })), /cancelled/);
    assert.equal(requests.length, count);
  } finally { clearInterval(keepAlive); }
});


test("explicit Parallel overrides configured Firecrawl without sending any ambient API key", async () => {
  process.env.FIRECRAWL_API_KEY = "configured";
  process.env.PARALLEL_API_KEY = "ambient-not-used";
  process.env.PERCEPTRON_WEB_PROVIDER = "parallel";
  assert.match(String(await runTool("searchWeb", search)), /routing excerpt/);
  assert.equal(requests.filter((r) => r.method === "tools/call").length, 1);
});

test("missing discovered tool fails before execution", async () => {
  failure = "discovery";
  assert.match(String(await runTool("searchWeb", search)), /does not offer web_search/);
  assert.equal(requests.filter((r) => r.method === "tools/call").length, 0);
});
