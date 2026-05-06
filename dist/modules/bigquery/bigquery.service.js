import { BigQueryRepository } from "./bigquery.repository.js";
export class BigQueryService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async listTablesFormatted() {
        const tables = await this.repository.listTables();
        return tables.map((t) => ({
            table_id: t.id,
            type: t.metadata?.type,
            description: t.metadata?.description || "",
            row_count: t.metadata?.numRows || "unknown",
            size_bytes: t.metadata?.numBytes || "unknown",
        }));
    }
    async getTableSchemaFormatted(tableId) {
        const metadata = await this.repository.getTableMetadata(tableId);
        const schema = metadata.schema?.fields || [];
        return {
            table_id: tableId,
            description: metadata.description || "",
            fields: schema.map((f) => ({
                name: f.name,
                type: f.type,
                mode: f.mode,
                description: f.description || "",
            })),
        };
    }
    async query(sql, maxBytesBilled) {
        const rows = await this.repository.runQuery(sql, String(maxBytesBilled));
        return rows;
    }
    async preview(tableId, projectId, datasetId, limit, maxBytesBilled) {
        const safeLimit = Math.min(limit, 100);
        const sql = `SELECT * FROM \`..%s\` LIMIT 0`;
        return await this.repository.runQuery(sql, String(maxBytesBilled));
    }
}
//# sourceMappingURL=bigquery.service.js.map