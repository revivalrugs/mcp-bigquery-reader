import { BigQuery, type TableMetadata } from "@google-cloud/bigquery";

export interface BigQueryConfig {
  projectId: string;
  datasetId: string;
}

export class BigQueryRepository {
  private client: BigQuery;
  private datasetId: string;

  constructor(config: BigQueryConfig) {
    this.client = new BigQuery({ projectId: config.projectId });
    this.datasetId = config.datasetId;
  }

  async listTables() {
    const [tables] = await this.client.dataset(this.datasetId).getTables();
    return tables;
  }

  async getTableMetadata(tableId: string): Promise<TableMetadata> {
    const [metadata] = await this.client.dataset(this.datasetId).table(tableId).getMetadata();
    return metadata;
  }

  async previewRows(tableId: string, limit: number) {
    const [rows] = await this.client
      .dataset(this.datasetId)
      .table(tableId)
      .getRows({ maxResults: limit });
    return rows;
  }

  async runQuery(sql: string, maxBytesBilled: string) {
    const options = {
      query: sql,
      maximumBytesBilled: maxBytesBilled,
      jobTimeoutMs: 60000,
    };
    const [rows] = await this.client.query(options);
    return rows;
  }
}
