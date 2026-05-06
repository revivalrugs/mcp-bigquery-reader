import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BigQueryService } from "./bigquery.service.js";
export declare function registerBigQueryTools(server: McpServer, service: BigQueryService, config: {
    projectId: string;
    datasetId: string;
    maxBytesBilled: number;
}): void;
//# sourceMappingURL=bigquery.tools.d.ts.map