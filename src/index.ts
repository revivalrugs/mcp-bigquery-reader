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

let cachedBearerToken: string | null = null;

async function getBearerToken(): Promise<string> {
  if (cachedBearerToken) return cachedBearerToken;
  const client = new SecretManagerServiceClient();
  const name = "projects/" + PROJECT_ID + "/secrets/" + BEARER_TOKEN_SECRET + "/versions/latest";
  const [version] = await client.accessSecretVersion({ name });
  const payload = version.payload?.data?.toString();
  if (!payload) throw new Error("Failed to load bearer token from Secret Manager");
  cachedBearerToken = payload.trim();
  return cachedBearerToken;
}

async function main() {
  console.error("Initializing BigQuery MCP server...");

  const repository = new BigQueryRepository({ projectId: PROJECT_ID, datasetId: DATASET_ID });
  const service = new BigQueryService(repository);
  
  const server = new McpServer({
    name: "bigquery-mcp",
    version: "1.0.0",
  });

  registerBigQueryTools(server, service, { 
    projectId: PROJECT_ID, 
    datasetId: DATASET_ID, 
    maxBytesBilled: MAX_BYTES_BILLED 
  });

  const httpServer = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (req.url !== "/mcp") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    try {
      const expectedToken = await getBearerToken();
      const authHeader = req.headers["authorization"] || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      
      if (token !== expectedToken) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }

      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("Request error:", error);
      res.writeHead(500);
      res.end("Internal Server Error");
    }
  });

  httpServer.listen(PORT, () => {
    console.error("MCP server listening on port " + PORT);
  });

  // Warm up token cache in background
  getBearerToken().catch(err => console.error("Failed to pre-fetch bearer token:", err));
}

main().catch((err) => {
  console.error("Fatal error during startup:", err);
  process.exit(1);
});
