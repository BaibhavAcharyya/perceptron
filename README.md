## Perceptron: Cloud based AI powered IDE

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Coding agent web tools

With no `FIRECRAWL_API_KEY` configured, the coding agent can use `searchWeb` to
find current documentation and `scrapeUrls` to read reference pages through
[Parallel Search MCP](https://docs.parallel.ai/integrations/mcp/search-mcp).
Search uses Fast mode, with no Parallel account or API key required. For example,
ask the agent: "Find the current Next.js routing docs and use them to explain how
to add a dynamic route." Results include source URLs and markdown excerpts.

Set `PERCEPTRON_WEB_PROVIDER` on the server to choose the behavior:

| Value | Coding agent tools |
| --- | --- |
| `auto` (default) | Keep Firecrawl URL scraping when `FIRECRAWL_API_KEY` is set; otherwise use Parallel search and page fetching. |
| `parallel` | Use anonymous Parallel search and page fetching, even when a Firecrawl key is set. |
| `firecrawl` | Keep the existing URL scraper; requires `FIRECRAWL_API_KEY`. |
| `disabled` | Register no web tools for the coding agent. |

Provider errors are returned to the agent without switching providers. Parallel
requests have a 30-second deadline and use the project's HTTP MCP client. Related
calls reuse a conversation identifier. Search queries, requested URLs and that
identifier are sent to Parallel; avoid including secrets. Free anonymous access
has service limits. Existing application authentication and Inngest conversation
cancellation still apply; an already-running web request may finish before its
deadline after a conversation is cancelled. This setting applies to the coding
agent; Quick Edit keeps its existing Firecrawl behavior.

Run the deterministic tool and scripted agent-network tests with `npm run test:web`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
