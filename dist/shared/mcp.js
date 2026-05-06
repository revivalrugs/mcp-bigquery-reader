import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export function toText(text) {
    return {
        content: [{ type: "text", text }],
    };
}
export function toError(error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
        isError: true,
        content: [{ type: "text", text: `Error: ${message}` }],
    };
}
//# sourceMappingURL=mcp.js.map