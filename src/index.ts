import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import http from "http";
import { BigQueryRepository } from "./modules/bigquery/bigquery.repository.js";
import { BigQueryService } from "./modules/bigquery/bigquery.service.js";
import { registerBigQueryTools } from "./modules/bigquery/bigquery.tools.js";

const PORT = parseInt(process.env.PORT || "8080");
const PROJECT_ID = process.env.PROJECT_ID || "revival-rugs-shopify";
const DATASET_ID = process.env.DATASET_ID || "revival_ai_data";
const BEARER_TOKEN_SECRET = process.env.BEARER_TOKEN_SECRET || "bq-mcp-bearer-token";
const MAX_BYTES_BILLED = parseInt(process.env.MAX_BYTES_BILLED || String(1 * 1024 * 1024 * 1024));

let cachedBearerToken: string = "";

async function fetchSecretToken(): Promise<string> {
  console.error("Fetching secret token from Secret Manager...");
  const client = new SecretManagerServiceClient();
  const name = "projects/" + PROJECT_ID + "/secrets/" + BEARER_TOKEN_SECRET + "/versions/latest";
  const [version] = await client.accessSecretVersion({ name });
  const payload = version.payload?.data?.toString();
  if (!payload) throw new Error("Bearer token secret is empty");
  return payload.trim();
}

async function main() {
  console.error("Starting BigQuery MCP Server...");

  // 1. Startup Cache & Fail-Fast
  try {
    cachedBearerToken = await fetchSecretToken();
    console.error("Auth token cached successfully.");
  } catch (err) {
    console.error("FATAL: Could not fetch bearer token at startup. Ensure Cloud Run Service Account has Secret Manager Access.", err);
    process.exit(1);
  }

  // 2. Singleton Infrastructure (Shared across requests to minimize latency)
  const repository = new BigQueryRepository({ projectId: PROJECT_ID, datasetId: DATASET_ID });
  const service = new BigQueryService(repository);

  const httpServer = http.createServer(async (req, res) => {
    // --- Global Health Check (Open) ---
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    // --- Global Auth Middleware (Enforced for all other routes) ---
    const authHeader = req.headers["authorization"] || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (token !== cachedBearerToken) {
      console.error("Unauthorized access attempt from IP: " + req.socket.remoteAddress);
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    // --- MCP Route (POST /mcp) ---
    if (req.url === "/mcp" && req.method === "POST") {
      try {
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        
        // Create fresh server per-request for stability, but reuse the singleton service
        const server = new McpServer({
          name: "bigquery-mcp",
          version: "1.0.0",
        });
        
        registerBigQueryTools(server, service, { 
          projectId: PROJECT_ID, 
          datasetId: DATASET_ID, 
          maxBytesBilled: MAX_BYTES_BILLED 
        });

        await server.connect(transport);
        await transport.handleRequest(req, res);
      } catch (error: any) {
        console.error("MCP Error:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal Server Error", message: error.message }));
      }
    } else {
      res.writeHead(404);
      res.end("Not Found");
    }
  });

  httpServer.listen(PORT, () => {
    console.error("MCP server listening on port " + PORT);
  });
}

main().catch((err) => {
  console.error("Unexpected fatal error during startup:", err);
  process.exit(1);
});
