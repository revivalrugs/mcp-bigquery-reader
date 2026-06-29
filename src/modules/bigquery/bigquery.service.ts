import { BigQueryRepository } from "./bigquery.repository.js";

export class BigQueryService {
  constructor(private repository: BigQueryRepository) {}

  async listTablesFormatted() {
    const tables = await this.repository.listTables();
    return tables.map((t: any) => ({
      table_id: t.id,
      type: t.metadata?.type,
      description: t.metadata?.description || "",
      row_count: t.metadata?.numRows || "unknown",
      size_bytes: t.metadata?.numBytes || "unknown",
    }));
  }

  async getTableSchemaFormatted(tableId: string) {
    const metadata = await this.repository.getTableMetadata(tableId);
    const schema = metadata.schema?.fields || [];
    return {
      table_id: tableId,
      description: metadata.description || "",
      fields: schema.map((f: any) => ({
        name: f.name,
        type: f.type,
        mode: f.mode,
        description: f.description || "",
      })),
    };
  }

  async query(sql: string, maxBytesBilled: number) {
    const rows = await this.repository.runQuery(sql, String(maxBytesBilled));
    return rows; 
  }

  async preview(tableId: string, limit: number) {
    const safeLimit = Math.min(limit, 100);
    return await this.repository.previewRows(tableId, safeLimit);
  }
}
