import { BigQuery } from "@google-cloud/bigquery";
export class BigQueryRepository {
    client;
    datasetId;
    constructor(config) {
        this.client = new BigQuery({ projectId: config.projectId });
        this.datasetId = config.datasetId;
    }
    async listTables() {
        const [tables] = await this.client.dataset(this.datasetId).getTables();
        return tables;
    }
    async getTableMetadata(tableId) {
        const [metadata] = await this.client.dataset(this.datasetId).table(tableId).getMetadata();
        return metadata;
    }
    async runQuery(sql, maxBytesBilled) {
        const options = {
            query: sql,
            maximumBytesBilled: maxBytesBilled,
            jobTimeoutMs: 60000,
        };
        const [rows] = await this.client.query(options);
        return rows;
    }
}
//# sourceMappingURL=bigquery.repository.js.map