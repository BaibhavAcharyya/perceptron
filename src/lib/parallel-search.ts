import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export const PARALLEL_MCP_URL = "https://search.parallel.ai/mcp";
export const WEB_USER_AGENT =
  "Perceptron/0.1.0 (+https://github.com/BaibhavAcharyya/perceptron)";

export interface WebContext {
  sessionId: string;
  modelName: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** One bounded MCP connection per durable tool execution; no ambient credentials. */
export async function callParallelTool(
  name: "web_search" | "web_fetch",
  args: Record<string, unknown>,
  context: WebContext,
): Promise<string> {
  const signal = AbortSignal.any([
    AbortSignal.timeout(context.timeoutMs ?? 30_000),
    ...(context.signal ? [context.signal] : []),
  ]);
  signal.throwIfAborted();
  const client = new Client({ name: "perceptron", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(PARALLEL_MCP_URL), {
    requestInit: { headers: { "User-Agent": WEB_USER_AGENT } },
    fetch: (input, init) => fetch(input, {
      ...init,
      signal: AbortSignal.any([signal, ...(init?.signal ? [init.signal] : [])]),
    }),
  });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools({}, { signal });
    if (!tools.some((tool) => tool.name === name)) {
      throw new Error(`Parallel does not offer ${name}`);
    }
    const result = CallToolResultSchema.parse(await client.callTool({
      name,
      arguments: {
        ...args,
        session_id: context.sessionId,
        model_name: context.modelName,
      },
    }, undefined, { signal }));
    const text = result.content
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n");
    if (result.isError) throw new Error(text || "Parallel request failed");
    if (!text) throw new Error("Parallel returned no text content");
    return text;
  } finally {
    await client.close();
  }
}
