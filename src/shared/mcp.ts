import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function toText(text: string) {
  return {
    content: [{ type: "text" as const, text }],
  };
}

export function toError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: "text" as const, text: `Error: ${message}` }],
  };
}
