/**
 * BigQuery MCP Server for Cloud Run
 * Single bearer token auth, scoped to revival_ai_data dataset
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { BigQuery } from "@google-cloud/bigquery";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { z } from "zod";
import http from "http";

// ─── Config ────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || "8080");
const PROJECT_ID = process.env.PROJECT_ID || "revival-rugs-shopify";
const DATASET_ID = process.env.DATASET_ID || "revival_ai_data";
const BEARER_TOKEN_SECRET = process.env.BEARER_TOKEN_SECRET || "bq-mcp-bearer-token";
const MAX_BYTES_BILLED = parseInt(process.env.MAX_BYTES_BILLED || String(1 * 1024 * 1024 * 1024)); // 1GB default

// ─── Secret Manager ────────────────────────────────────────────────────────

let cachedBearerToken = null;

async function getBearerToken() {
  if (cachedBearerToken) return cachedBearerToken;
  const client = new SecretManagerServiceClient();
  const name = `projects/${PROJECT_ID}/secrets/${BEARER_TOKEN_SECRET}/versions/latest`;
  const [version] = await client.accessSecretVersion({ name });
  cachedBearerToken = version.payload.data.toString("utf8").trim();
  return cachedBearerToken;
}

// ─── BigQuery client (uses Cloud Run's attached service account) ────────────

const bigquery = new BigQuery({ projectId: PROJECT_ID });

// ─── MCP Server setup ──────────────────────────────────────────────────────

function createMcpServer() {
  const server = new McpServer({
    name: "bigquery-mcp",
    version: "1.0.0",
  });

  // Tool: list tables in the dataset
  server.tool(
    "list_tables",
    "List all tables and views in the revival_ai_data dataset with their descriptions",
    {},
    async () => {
      const [tables] = await bigquery.dataset(DATASET_ID).getTables();
      const rows = tables.map((t) => ({
        table_id: t.id,
        type: t.metadata.type,
        description: t.metadata.description || "",
        row_count: t.metadata.numRows || "unknown",
        size_bytes: t.metadata.numBytes || "unknown",
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      };
    }
  );

  // Tool: get schema for a specific table
  server.tool(
    "get_table_schema",
    "Get the full schema (columns, types, descriptions) for a specific table",
    { table_id: z.string().describe("The table or view name within revival_ai_data") },
    async ({ table_id }) => {
      const [metadata] = await bigquery.dataset(DATASET_ID).table(table_id).getMetadata();
      const schema = metadata.schema?.fields || [];
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                table_id,
                description: metadata.description || "",
                fields: schema.map((f) => ({
                  name: f.name,
                  type: f.type,
                  mode: f.mode,
                  description: f.description || "",
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Tool: run a read-only SQL query
  server.tool(
    "query",
    "Run a read-only SQL query against the revival_ai_data dataset. Always qualify table names as `revival-rugs-shopify.revival_ai_data.table_name`.",
    {
      sql: z.string().describe("A read-only BigQuery SQL query"),
      max_bytes_billed: z
        .number()
        .optional()
        .describe(`Maximum bytes billed. Defaults to ${MAX_BYTES_BILLED} (1GB)`),
    },
    async ({ sql, max_bytes_billed }) => {
      const options = {
        query: sql,
        maximumBytesBilled: String(max_bytes_billed || MAX_BYTES_BILLED),
        jobTimeoutMs: 60000,
      };
      const [rows] = await bigquery.query(options);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(rows, null, 2),
          },
        ],
      };
    }
  );

  // Tool: preview first N rows of a table
  server.tool(
    "preview_table",
    "Preview the first N rows of a table (default 10)",
    {
      table_id: z.string().describe("The table or view name within revival_ai_data"),
      limit: z.number().optional().describe("Number of rows to return (default 10, max 100)"),
    },
    async ({ table_id, limit = 10 }) => {
      const safeLimit = Math.min(limit, 100);
      const sql = `SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.${table_id}\` LIMIT ${safeLimit}`;
      const [rows] = await bigquery.query({
        query: sql,
        maximumBytesBilled: String(MAX_BYTES_BILLED),
      });
      return {
        content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      };
    }
  );

  return server;
}

// ─── HTTP server with bearer token auth ───────────────────────────────────

async function main() {
  console.log(`Starting BigQuery MCP server...`);
  console.log(`Project: ${PROJECT_ID}, Dataset: ${DATASET_ID}`);

  // Pre-fetch the bearer token on startup so we fail fast if Secret Manager is misconfigured
  const expectedToken = await getBearerToken();
  console.log("Bearer token loaded from Secret Manager");

  const httpServer = http.createServer(async (req, res) => {
    // Health check endpoint for Cloud Run
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    // All MCP requests must be POSTs to /mcp
    if (req.url !== "/mcp") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    // Validate bearer token
    const authHeader = req.headers["authorization"] || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (token !== expectedToken) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    // Handle MCP request
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = createMcpServer();
    await server.connect(transport);
    await transport.handleRequest(req, res);
  });

  httpServer.listen(PORT, () => {
    console.log(`MCP server listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
