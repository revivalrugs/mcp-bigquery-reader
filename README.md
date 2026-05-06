# BigQuery MCP Server

A remote MCP server that gives Claude Team users read-only access to the
`revival-rugs-shopify.revival_ai_data` BigQuery dataset.

## Architecture

```
Claude Desktop (each user)
        ↓  HTTPS + Bearer token
Cloud Run (bq-mcp-server)
        ↓  Service account (BigQuery Data Viewer + Job User)
revival-rugs-shopify.revival_ai_data
```

- Auth: single org-wide bearer token stored in Secret Manager
- No local setup required for end users — connector is registered once in
  the Claude Team admin console and propagates to everyone automatically
- Read-only: no write permissions on BigQuery

## Available MCP Tools

| Tool | Description |
|---|---|
| `list_tables` | Lists all tables/views in the dataset with row counts |
| `get_table_schema` | Returns full schema for a specific table |
| `query` | Runs an arbitrary read-only SQL query (1GB max bytes billed) |
| `preview_table` | Returns first N rows of a table (max 100) |

## Prerequisites

- `gcloud` CLI installed and authenticated
- Permissions: Cloud Run Admin, IAM Admin, Secret Manager Admin, Cloud Build Editor
- Docker not required (Cloud Build handles the image build)

## Deployment

```bash
cd bq-mcp-server
chmod +x deploy.sh
./deploy.sh
```

The script will:
1. Create a dedicated service account with minimal BigQuery permissions
2. Generate a bearer token and store it in Secret Manager
3. Build and push the Docker image via Cloud Build
4. Deploy the service to Cloud Run (unauthenticated access disabled)
5. Print the service URL and bearer token needed for Claude Team setup

**Important:** Save the bearer token printed during Step 2. It is only
shown once. If lost, run:
```bash
gcloud secrets versions access latest \
  --secret=bq-mcp-bearer-token \
  --project=revival-rugs-shopify
```

## Claude Team Admin Console Setup

After deployment, register the connector once:

1. Go to **claude.ai → Settings → Integrations**
2. Click **Add MCP Server**
3. Enter the Cloud Run URL: `https://<service-url>/mcp`
4. Set auth type to **Bearer token** and paste the token from deployment
5. Save — the connector will appear for all team members automatically

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PROJECT_ID` | `revival-rugs-shopify` | GCP project ID |
| `DATASET_ID` | `revival_ai_data` | BigQuery dataset to expose |
| `BEARER_TOKEN_SECRET` | `bq-mcp-bearer-token` | Secret Manager secret name |
| `MAX_BYTES_BILLED` | `1073741824` (1GB) | Max bytes billed per query |
| `PORT` | `8080` | HTTP port (set automatically by Cloud Run) |

## Health Check

```bash
curl https://<service-url>/health
# → {"status":"ok"}
```

## Updating the Bearer Token

```bash
# Generate a new token
NEW_TOKEN=$(openssl rand -base64 32)

# Store as new secret version
echo -n "$NEW_TOKEN" | gcloud secrets versions add bq-mcp-bearer-token \
  --data-file=- \
  --project=revival-rugs-shopify

# Restart Cloud Run to pick it up (or wait — token is cached in memory)
gcloud run services update bq-mcp-server \
  --region=us-central1 \
  --project=revival-rugs-shopify
```

Then update the token in the Claude Team admin console.
