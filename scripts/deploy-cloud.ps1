# Run from the repository root after local checks pass. Uses the caller's Google identity.
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
Invoke-Gcloud builds submit . "--project=$project" '--config=infrastructure/cloudbuild.yaml' "--substitutions=_IMAGE=$image"
Invoke-Gcloud run deploy claimflow-api "--project=$project" "--region=$region" "--image=$image" "--service-account=$runtime" '--no-allow-unauthenticated' '--min-instances=0' '--max-instances=1' '--concurrency=20' '--memory=512Mi' '--cpu=1' '--timeout=60' '--port=8080' "--set-env-vars=NODE_ENV=production,SERVE_WEB=true,DATABASE_MODE=firestore,STORAGE_MODE=gcs,AI_MODE=mock,GOOGLE_CLOUD_PROJECT=$project,GOOGLE_CLOUD_LOCATION=$region,FIRESTORE_DATABASE_ID=(default),DOCUMENT_BUCKET=$project-documents"
Invoke-Gcloud run services describe claimflow-api "--project=$project" "--region=$region" '--format=value(status.url)'
Write-Host 'Private service deployed. Verify /ready and the full workflow through gcloud run services proxy; see docs/cloud-deployment.md.'
