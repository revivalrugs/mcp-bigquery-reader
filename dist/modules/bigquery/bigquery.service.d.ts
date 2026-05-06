import { BigQueryRepository } from "./bigquery.repository.js";
export declare class BigQueryService {
    private repository;
    constructor(repository: BigQueryRepository);
    listTablesFormatted(): Promise<{
        table_id: any;
        type: any;
        description: any;
        row_count: any;
        size_bytes: any;
    }[]>;
    getTableSchemaFormatted(tableId: string): Promise<{
        table_id: string;
        description: string;
        fields: {
            name: any;
            type: any;
            mode: any;
            description: any;
        }[];
    }>;
    query(sql: string, maxBytesBilled: number): Promise<any[]>;
    preview(tableId: string, projectId: string, datasetId: string, limit: number, maxBytesBilled: number): Promise<any[]>;
}
//# sourceMappingURL=bigquery.service.d.ts.map