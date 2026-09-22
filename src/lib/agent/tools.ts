import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { createCatalogOps, type CatalogOps } from "@/data/catalog";

export const SEARCH_TOOL = "ledger.search";
export const OPEN_TOOL = "ledger.open";

export function callTool(
  ops: CatalogOps,
  name: string,
  args: Record<string, unknown>,
): string {
  if (name === SEARCH_TOOL) {
    const query = typeof args.query === "string" ? args.query : "";
    return JSON.stringify({ hits: ops.search(query) });
  }
  if (name === OPEN_TOOL) {
    const id = typeof args.id === "string" ? args.id : "";
    const card = ops.read(id);
    return JSON.stringify(card ? { found: true, card } : { found: false });
  }
  throw new Error(`Unknown tool: ${name}`);
}

export function createModelTools() {
  const ops = createCatalogOps();
  return [
    tool(
      async ({ query }) => callTool(ops, SEARCH_TOOL, { query }),
      {
        name: SEARCH_TOOL,
        description:
          "Searches the closed run ledger. Returns at most five hits, or an empty list.",
        schema: z.object({
          query: z.string().describe("The question, or the rule name"),
        }),
      },
    ),
    tool(
      async ({ id }) => callTool(ops, OPEN_TOOL, { id }),
      {
        name: OPEN_TOOL,
        description: "Opens one ledger card by the exact id returned by ledger.search.",
        schema: z.object({
          id: z.string().describe("Card id"),
        }),
      },
    ),
  ];
}
