# Vertex extraction diagnostics

The first live Vertex smoke test reached EXTRACTION but failed before validation. The previous generic message did not preserve enough diagnostic information, and a Cloud Logging WARNING query returned no entries. The live cause is still unconfirmed.

Provider failures now emit one structured ERROR event, `VERTEX_EXTRACTION_FAILED`, and persist a safe category and HTTP status in the workflow error summary. Raw error messages, document text, credentials and response bodies are not logged. Hints are allowlisted classifications, not proof of the underlying cause. No retry was added.

After deploying this change with `scripts/deploy-cloud.ps1 -AiMode vertex`, run the Vertex smoke test once through the authenticated proxy. If it fails, share its error summary and read:

```powershell
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="claimflow-api" AND jsonPayload.event="VERTEX_EXTRACTION_FAILED"' --project=claimflow-ai-agents --freshness=1h --limit=5 --format=json
```

HTTP 400 indicates a rejected request; 401/403 indicates authentication, authorization or project restrictions; 404 indicates model availability; 429 indicates quota/rate limits; 5xx indicates a provider server error. Errors without a recognized HTTP status are identified as client errors or timeouts. Check the reported category before changing the model, permissions or schema. Failed cases remain available for review and are not automatically rerun.
