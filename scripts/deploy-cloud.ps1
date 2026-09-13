# Fallback manual deploy. Normal production deployment is performed by GitHub Actions after CI passes on main.
param(
  [ValidateSet('mock', 'vertex')][string]$AiMode = 'mock',
  [ValidatePattern('^gemini-[a-z0-9.-]+$')][string]$GeminiModel = 'gemini-3.5-flash',
  [ValidatePattern('^[a-z0-9-]+$')][string]$VertexLocation = 'global'
)
$ErrorActionPreference = 'Stop'
function Invoke-Gcloud {
  & gcloud @args
  if ($LASTEXITCODE -ne 0) { throw "gcloud failed (exit $LASTEXITCODE). Deployment stopped." }
}
$project = 'claimflow-ai-agents'
$region = 'australia-southeast1'
$runtime = "claimflow-api-runtime@$project.iam.gserviceaccount.com"
$tag = (git rev-parse --short=12 HEAD)
if ($LASTEXITCODE -ne 0) { throw 'Run from the repository root.' }
if (git status --porcelain) { throw 'Commit or stash changes before deploying a reproducible image.' }
$image = "$region-docker.pkg.dev/$project/claimflow-containers/claimflow-api:$tag"
Invoke-Gcloud firestore databases describe '--database=(default)' "--project=$project"
Invoke-Gcloud storage buckets describe "gs://$project-documents" "--project=$project"
Invoke-Gcloud artifacts repositories describe claimflow-containers "--location=$region" "--project=$project"
Invoke-Gcloud iam service-accounts describe $runtime "--project=$project"
if ($AiMode -eq 'vertex') {
  Invoke-Gcloud services enable aiplatform.googleapis.com "--project=$project"
  Invoke-Gcloud projects add-iam-policy-binding $project "--member=serviceAccount:$runtime" '--role=roles/aiplatform.user' '--condition=None'
}
Invoke-Gcloud builds submit . "--project=$project" '--config=infrastructure/cloudbuild.yaml' "--substitutions=_IMAGE=$image"
Invoke-Gcloud run deploy claimflow-api "--project=$project" "--region=$region" "--image=$image" "--service-account=$runtime" '--min-instances=0' '--max-instances=1' '--concurrency=4' '--memory=1Gi' '--cpu=1' '--timeout=120' '--port=8080' "--set-env-vars=NODE_ENV=production,SERVE_WEB=true,DATABASE_MODE=firestore,STORAGE_MODE=gcs,AI_MODE=$AiMode,GEMINI_MODEL=$GeminiModel,VERTEX_LOCATION=$VertexLocation,GOOGLE_CLOUD_PROJECT=$project,GOOGLE_CLOUD_LOCATION=$region,FIRESTORE_DATABASE_ID=(default),DOCUMENT_BUCKET=$project-documents"
Invoke-Gcloud run services describe claimflow-api "--project=$project" "--region=$region" '--format=value(status.url)'
Write-Host 'Service deployed. Existing Cloud Run invocation IAM (including public access, if configured) is preserved.'
