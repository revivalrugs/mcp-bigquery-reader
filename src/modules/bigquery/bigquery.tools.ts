import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BigQueryService } from "./bigquery.service.js";
import { toText, toError } from "../../shared/mcp.js";

export function registerBigQueryTools(
  server: McpServer,
  service: BigQueryService,
  config: { projectId: string; datasetId: string; maxBytesBilled: number; allowDatasetOverride: boolean }
) {

  const datasetParam: Record<string, z.ZodTypeAny> = config.allowDatasetOverride
    ? {
        dataset_id: z
          .string()
          .optional()
          .describe(`Optional. The dataset to target instead of the default (${config.datasetId}).`),
      }
    : {};


  const resolveDataset = (datasetId?: string) =>
    config.allowDatasetOverride && datasetId ? datasetId : config.datasetId;

  server.tool(
    "list_tables",
    `List all tables and views in the ${config.datasetId} dataset with their descriptions`,
    { ...datasetParam },
    async (args) => {
      try {
        const dataset = resolveDataset((args as { dataset_id?: string }).dataset_id);
        const rows = await service.listTablesFormatted(dataset);
        return toText(JSON.stringify(rows, null, 2));
      } catch (error) {
        return toError(error);
      }
    }
  );

  server.tool(
    "get_table_schema",
    "Get the full schema (columns, types, descriptions) for a specific table",
    { table_id: z.string().describe("The table or view name"), ...datasetParam },
    async (args) => {
      try {
        const dataset = resolveDataset((args as { dataset_id?: string }).dataset_id);
        const schema = await service.getTableSchemaFormatted(args.table_id, dataset);
        return toText(JSON.stringify(schema, null, 2));
      } catch (error) {
        return toError(error);
      }
    }
  );

  server.tool(
    "query",
    `Run a read-only SQL query against the ${config.datasetId} dataset.`,
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
      table_id: z.string().describe("The table or view name"),
      limit: z.number().optional().describe("Number of rows to return (default 10, max 100)"),
      ...datasetParam,
    },
    async (args) => {
      try {
        const dataset = resolveDataset((args as { dataset_id?: string }).dataset_id);
        const rows = await service.preview(args.table_id, args.limit ?? 10, dataset);
        return toText(JSON.stringify(rows, null, 2));
      } catch (error) {
        return toError(error);
      }
    }
  );
}
