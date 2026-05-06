import { type TableMetadata } from "@google-cloud/bigquery";
export interface BigQueryConfig {
    projectId: string;
    datasetId: string;
}
export declare class BigQueryRepository {
    private client;
    private datasetId;
    constructor(config: BigQueryConfig);
    listTables(): Promise<import("@google-cloud/bigquery").Table[]>;
    getTableMetadata(tableId: string): Promise<TableMetadata>;
    runQuery(sql: string, maxBytesBilled: string): Promise<any[]>;
}
//# sourceMappingURL=bigquery.repository.d.ts.map