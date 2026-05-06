#!/bin/bash
# setup-infra.sh (deploy.sh) — Prepare GCP for GitHub-based deployment
# Run this once to set up IAM and Secrets before connecting GitHub to Cloud Run.

set -e

# ─── Config (edit these if needed) ─────────────────────────────────────────
PROJECT_ID="revival-rugs-shopify"
REGION="us-central1"
SERVICE_NAME="mcp-bigquery-connector"
SA_NAME="sa-mcp-bq-reader"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
BEARER_SECRET_NAME="mcp-bq-auth-token"
DATASET_ID="revival_ai_data"

echo "=== BigQuery MCP Infrastructure Setup ==="
echo "Project:  ${PROJECT_ID}"
echo "Region:   ${REGION}"
echo "Service:  ${SERVICE_NAME}"
echo ""

# ─── Step 1: Create service account (if it doesn't exist) ──────────────────
echo "--- Step 1: Service account & IAM ---"
if ! gcloud iam service-accounts describe "${SA_EMAIL}" --project="${PROJECT_ID}" &>/dev/null; then
  gcloud iam service-accounts create "${SA_NAME}" \
    --display-name="MCP BigQuery Reader (Cloud Run)" \
    --project="${PROJECT_ID}"
  echo "Created service account: ${SA_EMAIL}"
  
  echo "Waiting for service account to propagate (15s)..."
  sleep 15
else
  echo "Service account already exists: ${SA_EMAIL}"
fi

# Grant BigQuery permissions
echo "Assigning BigQuery roles..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/bigquery.dataViewer" > /dev/null

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/bigquery.jobUser" > /dev/null

# Grant access to Secret Manager
echo "Assigning Secret Manager roles..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" > /dev/null

echo "IAM permissions granted to ${SA_EMAIL}"

# ─── Step 2: Bearer token secret ───────────────────────────────────────────
echo ""
echo "--- Step 2: Bearer token secret ---"

if ! gcloud secrets describe "${BEARER_SECRET_NAME}" --project="${PROJECT_ID}" &>/dev/null; then
  echo "Creating new secret..."
  BEARER_TOKEN=$(openssl rand -base64 32 | tr -d '\n')
  
  # Create secret with labels only (most reliable)
  echo -n "${BEARER_TOKEN}" | gcloud secrets create "${BEARER_SECRET_NAME}" \
    --data-file=- \
    --project="${PROJECT_ID}" \
    --labels="managed-by=mcp-installer,component=mcp-connector"
else
  echo "Secret '${BEARER_SECRET_NAME}' already exists. Fetching current value..."
  BEARER_TOKEN=$(gcloud secrets versions access latest --secret="${BEARER_SECRET_NAME}" --project="${PROJECT_ID}")
fi

echo ""
echo "================================================================"
echo "IMPORTANT: Bearer token ready. Save this value:"
echo ""
echo "  ${BEARER_TOKEN}"
echo ""
echo "================================================================"

echo ""
echo "=== Setup Complete! ==="
echo ""
echo "Next Steps to connect GitHub:"
echo "1. Push your code to GitHub."
echo "2. Go to Google Cloud Console -> Cloud Run -> Create Service."
echo "3. Select 'Continuously deploy from a repository'."
echo "4. Connect your GitHub repo and select 'Dockerfile' as build type."
echo "5. IMPORTANT: In 'Container' tab, set these variables:"
echo "   - PROJECT_ID: ${PROJECT_ID}"
echo "   - DATASET_ID: ${DATASET_ID}"
echo "   - BEARER_TOKEN_SECRET: ${BEARER_SECRET_NAME}"
echo "6. In 'Security' tab, select Service Account: ${SA_EMAIL}"
echo "7. Deploy!"
