import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BigQueryService } from "./bigquery.service.js";
import { toText, toError } from "../../shared/mcp.js";

export function registerBigQueryTools(server: McpServer, service: BigQueryService, config: { projectId: string, datasetId: string, maxBytesBilled: number }) {
  server.tool(
    "list_tables",
    "List all tables and views in the revival_ai_data dataset with their descriptions",
    {},
    async () => {
      try {
        const rows = await service.listTablesFormatted();
        return toText(JSON.stringify(rows, null, 2));
      } catch (error) {
        return toError(error);
      }
    }
  );

  server.tool(
    "get_table_schema",
    "Get the full schema (columns, types, descriptions) for a specific table",
    { table_id: z.string().describe("The table or view name within revival_ai_data") },
    async ({ table_id }) => {
      try {
        const schema = await service.getTableSchemaFormatted(table_id);
        return toText(JSON.stringify(schema, null, 2));
      } catch (error) {
        return toError(error);
      }
    }
  );

  server.tool(
    "query",
    "Run a read-only SQL query against the revival_ai_data dataset.",
    {
      sql: z.string().describe("A read-only BigQuery SQL query"),
      max_bytes_billed: z
        .number()
        .optional()
        .describe("Maximum bytes billed. Defaults to 1GB"),
    },
    async ({ sql, max_bytes_billed }) => {
      try {
        const rows = await service.query(sql, max_bytes_billed || config.maxBytesBilled);
        return toText(JSON.stringify(rows, null, 2));
      } catch (error) {
        return toError(error);
      }
    }
  );

  server.tool(
    "preview_table",
    "Preview the first N rows of a table (default 10)",
    {
      table_id: z.string().describe("The table or view name within revival_ai_data"),
      limit: z.number().optional().describe("Number of rows to return (default 10, max 100)"),
    },
    async ({ table_id, limit = 10 }) => {
      try {
        const rows = await service.preview(table_id, config.projectId, config.datasetId, limit, config.maxBytesBilled);
        return toText(JSON.stringify(rows, null, 2));
      } catch (error) {
        return toError(error);
      }
    }
  );
}
