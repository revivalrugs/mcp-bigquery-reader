# BigQuery MCP Server

A remote MCP server that gives Claude Team users read-only access to the
`revival-rugs-shopify.revival_ai_data` BigQuery dataset.

## Architecture

```
Claude (each team member, via the shared connector)
        ↓  HTTPS + org-wide Bearer token
Cloud Run (mcp-bigquery-reader)
        ↓  Service account (BigQuery Data Viewer + Job User)
revival-rugs-shopify.revival_ai_data
```

- **Auth:** a single org-wide bearer token, stored in Secret Manager. The
  Cloud Run service allows unauthenticated invocations — the app-level bearer
  token is the security boundary, not Cloud Run IAM.
- **Distribution:** the connector is registered once for the whole
  organization; every member gets it automatically and shares the same token
  (see [Claude Team Setup](#claude-team-setup)).
- **Read-only:** the service account has no write permissions on BigQuery.

## Available MCP Tools

| Tool | Description |
|---|---|
| `list_tables` | Lists all tables/views in the dataset with row counts |
| `get_table_schema` | Returns full schema for a specific table |
| `query` | Runs a read-only SQL query (1GB max bytes billed) |
| `preview_table` | Returns first N rows of a table (max 100) |

## How Auth Works

There are two independent layers:

1. **Bearer token** — gates *who may call the server*. Every request to `/mcp`
   must send `Authorization: Bearer <token>`. The token is a random value
   generated at setup and kept in Secret Manager. It carries no project or
   dataset scope — it is purely an on/off door key.
2. **Service account IAM** — gates *what the server may do in GCP*. The server
   runs as `sa-mcp-bq-reader@revival-rugs-shopify.iam.gserviceaccount.com` with
   `bigquery.dataViewer` + `bigquery.jobUser` (read-only) and
   `secretmanager.secretAccessor` (to read its own token).

The same org-wide token is shared by every team member, so there is no
per-user audit trail or per-user revocation — rotating the token affects
everyone (see [Rotating the Bearer Token](#rotating-the-bearer-token)).

## Prerequisites

- `gcloud` CLI installed and authenticated
- Permissions: IAM Admin, Secret Manager Admin (for `deploy.sh`), plus Cloud
  Run Admin to create the service
- A GitHub repo connected to Cloud Run (the image is built from the
  `Dockerfile` by Cloud Build)

## Deployment

Deployment is two stages: a one-time infra setup script, then a GitHub-based
Cloud Run service.

### 1. Set up IAM + secret

```bash
chmod +x deploy.sh
./deploy.sh
```

`deploy.sh` does **not** build or deploy the service. It only:

1. Creates the `sa-mcp-bq-reader` service account with minimal BigQuery
   permissions.
2. Generates a bearer token and stores it in Secret Manager as
   `mcp-bq-auth-token` (or reuses the existing one).
3. Prints the bearer token — **save it**, you need it for the connector.

### 2. Create the Cloud Run service from GitHub

1. Push this repo to GitHub.
2. Google Cloud Console → **Cloud Run** → **Create Service**.
3. Select **Continuously deploy from a repository** and connect this repo;
   choose **Dockerfile** as the build type.
4. In the **Container** tab, set environment variables:
   - `PROJECT_ID` = `revival-rugs-shopify`
   - `DATASET_ID` = `revival_ai_data`
   - `BEARER_TOKEN_SECRET` = `mcp-bq-auth-token`
5. In the **Security** tab, set the service account to
   `sa-mcp-bq-reader@revival-rugs-shopify.iam.gserviceaccount.com`.
6. Allow **unauthenticated invocations** (the bearer token is the gate).
7. Deploy. Note the service URL — the MCP endpoint is `<service-url>/mcp`.

The current deployment is:
`https://mcp-bigquery-reader-60108057361.us-central1.run.app/mcp`

## Claude Team Setup

This is a Claude Team project: the connector is added **once** for the whole
organization, and every member picks it up automatically — no per-user GCP or
`gcloud` setup.

The packaged connector lives in
[claude_extension/](claude_extension/) (`mcp-bigquery-extension.mcpb`). It is a
thin `mcp-remote` proxy that forwards to the Cloud Run `/mcp` endpoint with the
org bearer token attached. See
[claude_extension/manifest.json](claude_extension/manifest.json) for the exact
URL and header it sends.

To roll it out:

1. Register the connector once in the Claude Team admin console (Connectors /
   Integrations), pointing at `<service-url>/mcp` with **Bearer token** auth and
   the token from `deploy.sh`.
2. It becomes available to all team members; each installs it and shares the
   same org-wide token.

If you lose the token, read it back from Secret Manager:

```bash
gcloud secrets versions access latest \
  --secret=mcp-bq-auth-token \
  --project=revival-rugs-shopify
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PROJECT_ID` | `revival-rugs-shopify` | GCP project ID |
| `DATASET_ID` | `revival_ai_data` | BigQuery dataset to expose |
| `BEARER_TOKEN_SECRET` | `mcp-bq-auth-token` | Secret Manager secret name |
| `MAX_BYTES_BILLED` | `1073741824` (1GB) | Max bytes billed per query |
| `PORT` | `8080` | HTTP port (set automatically by Cloud Run) |

## Health Check

```bash
curl https://<service-url>/health
# → {"status":"ok"}
```

## Rotating the Bearer Token

The token is cached in memory for the lifetime of each Cloud Run instance and
is **never** auto-refreshed. Adding a new secret version alone has no effect —
you must restart the service so it re-reads the secret.

```bash
# Generate a new token and store it as a new secret version
NEW_TOKEN=$(openssl rand -base64 32 | tr -d '\n')
echo -n "$NEW_TOKEN" | gcloud secrets versions add mcp-bq-auth-token \
  --data-file=- \
  --project=revival-rugs-shopify

# Force a restart so the new token is picked up (a no-op update redeploys)
gcloud run services update mcp-bigquery-reader \
  --region=us-central1 \
  --project=revival-rugs-shopify
```

Then update the token in the Claude Team connector. Note: during a rollout,
old instances keep accepting the old token until they are fully replaced.
