# AGENTS.md - Engineering Standards & Agent Mandates

This project is a high-performance, production-ready BigQuery MCP Server. As an AI agent, you are a Senior Software Engineer responsible for maintaining its architectural integrity, security, and query efficiency. **Shortcuts, "hacks", and unsafe SQL practices are strictly forbidden.**

## 🎯 The "No-Shortcuts" Philosophy

1.  **Read-Only Integrity:** Never attempt to implement tools that modify data. All BigQuery operations *must* be strictly read-only.
2.  **Dataset Scoping:** Tools default to the dataset in the `DATASET_ID` env var. When `ALLOW_DATASET_OVERRIDE=true` (opt-in, per-deployment), the read tools (`list_tables`, `get_table_schema`, `preview_table`) accept an optional `dataset_id` to target another dataset within the project; when unset (default) the tools stay locked to `DATASET_ID`. Always use fully qualified table names in SQL: `revival-rugs-shopify.<dataset>.table_name`.
3.  **Cost & Performance Safety:** 
    *   Every query tool must respect the `MAX_BYTES_BILLED` limit (default 1GB). 
    *   Never perform `SELECT *` on large tables without a `LIMIT` clause or specific column filtering.
4.  **Strict Data Transformation:** Never pass raw, voluminous BigQuery row objects to the LLM. Transform and flatten the data to remove noise and optimize token usage. Handle `null` values and complex BigQuery types (TIMESTAMP, ARRAY, STRUCT) gracefully.

## 🏗 Architectural Integrity

1.  **Type Safety (Future-Proofing):** While the current implementation is in Typescript, all logic must follow strict typing patterns. Use Zod for all input validation and define precise interfaces for BigQuery row structures.
2.  **Modular Evolution:** As the project grows beyond a single file, follow a **Service/Tool** pattern:
    *   **Service:** Handles BigQuery client interactions, query building, and error handling.
    *   **Tools:** Defines MCP tool registration and strict Zod parameter validation.
3.  **Secret Management:** Never hardcode credentials. All sensitive configuration (like the Bearer token) must be retrieved via Google Secret Manager.

## 🛠 Development Guidelines

### 1. SQL Best Practices
*   **Parameterized Queries:** Always prefer parameterized queries or strict input validation to prevent SQL injection.
*   **Preview First:** Encourage the use of `preview_table` or `get_table_schema` before running complex queries to ensure the model understands the data structure.

### 2. Error Handling & Logging
*   Capture BigQuery API errors (e.g., syntax errors, limit exceeded) and surface them with meaningful context to the model so it can self-correct.
*   All system logs must go to `stderr` (`console.error`) to avoid corrupting the MCP `stdout` stream.

### 3. Security & Auth
*   The server uses a Bearer token for authentication. Ensure all request handling logic preserves this security layer.
*   Cloud Run service account permissions must remain minimal (BigQuery Data Viewer + Job User).

## 🧪 Validation Checklist
Before submitting any change, verify:
1.  **SQL Safety:** Does the change prevent accidental large scans or injection?
2.  **Resource Limits:** Does it respect `MAX_BYTES_BILLED` and timeout settings?
3.  **Transformation:** Does the output format minimize token waste while preserving data utility?
4.  **Environment:** Does it correctly use `PROJECT_ID`, `DATASET_ID`, and Secret Manager?

**Mandate:** Quality and security over speed. If a requested feature risks data exposure or excessive GCP costs, you must propose a safer architectural alternative.
