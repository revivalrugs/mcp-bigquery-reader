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
const BEARER_TOKEN_SECRET = process.env.BEARER_TOKEN_SECRET || "mcp-bq-auth-token";
const MAX_BYTES_BILLED = parseInt(process.env.MAX_BYTES_BILLED || String(1 * 1024 * 1024 * 1024));
const ALLOW_DATASET_OVERRIDE = process.env.ALLOW_DATASET_OVERRIDE === "true";

let cachedBearerToken: string | null = null;

async function fetchSecretToken(): Promise<string> {
  const client = new SecretManagerServiceClient();
  const name = "projects/" + PROJECT_ID + "/secrets/" + BEARER_TOKEN_SECRET + "/versions/latest";
  const [version] = await client.accessSecretVersion({ name });
  const payload = version.payload?.data?.toString();
  if (!payload) throw new Error("Bearer token secret is empty");
  return payload.trim();
}

async function main() {
  console.error("Starting BigQuery MCP Server...");

  const repository = new BigQueryRepository({ projectId: PROJECT_ID, datasetId: DATASET_ID });
  const service = new BigQueryService(repository);

  const httpServer = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (req.url !== "/mcp") {
      res.writeHead(404).end();
      return;
    }

    try {
      if (cachedBearerToken === null) {
        cachedBearerToken = await fetchSecretToken();
      }

      const authHeader = req.headers["authorization"] || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

      if (token !== cachedBearerToken) {
        res.writeHead(401).end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }

      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      const server = new McpServer({ name: "bigquery-mcp", version: "1.0.0" });
      registerBigQueryTools(server, service, { projectId: PROJECT_ID, datasetId: DATASET_ID, maxBytesBilled: MAX_BYTES_BILLED, allowDatasetOverride: ALLOW_DATASET_OVERRIDE });
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error: any) {
      console.error("Request Error:", error);
      res.writeHead(500).end(JSON.stringify({ error: "Internal Error" }));
    }
  });

  httpServer.listen(PORT, () => {
    console.error("Server listening on port " + PORT);
  });

  fetchSecretToken().then(t => { cachedBearerToken = t; }).catch(e => console.error("Token cache failed", e));
}

main().catch(err => { console.error("Fatal", err); process.exit(1); });
 