# One-time bootstrap for the live RAG -> Vertex acceptance test in GitHub Actions.
# Run with a Google identity that can manage project IAM and service-account IAM.
param(
  [string]$Project = 'claimflow-ai-agents',
  [string]$GitHubRepo = 'amin076/claimflow-agent'
)

$ErrorActionPreference = 'Stop'
$poolId = 'claimflow-github'
$providerId = 'main'
$serviceAccountName = 'claimflow-rag-acceptance'
$serviceAccount = "$serviceAccountName@$Project.iam.gserviceaccount.com"

function Invoke-Gcloud {
  & gcloud @args
  if ($LASTEXITCODE -ne 0) { throw "gcloud failed (exit $LASTEXITCODE): gcloud $args" }
}

function Test-Gcloud {
  $previousPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'SilentlyContinue'
    & gcloud @args *> $null
    return $LASTEXITCODE -eq 0
  } finally {
    $ErrorActionPreference = $previousPreference
  }
}

Write-Host "Configuring dedicated live RAG acceptance identity for $GitHubRepo"

Invoke-Gcloud services enable `
  aiplatform.googleapis.com `
  iamcredentials.googleapis.com `
  sts.googleapis.com `
  "--project=$Project"

if (-not (Test-Gcloud iam service-accounts describe $serviceAccount "--project=$Project")) {
  Invoke-Gcloud iam service-accounts create $serviceAccountName `
    "--project=$Project" `
    '--display-name=ClaimFlow RAG acceptance'
}

# Keep Vertex inference separate from the GitHub deployment identity.
Invoke-Gcloud projects add-iam-policy-binding $Project `
  "--member=serviceAccount:$serviceAccount" `
  '--role=roles/aiplatform.user' `
  '--condition=None'

$poolName = (& gcloud iam workload-identity-pools describe $poolId `
  '--location=global' `
  "--project=$Project" `
  '--format=value(name)').Trim()

$providerName = (& gcloud iam workload-identity-pools providers describe $providerId `
  "--workload-identity-pool=$poolId" `
  '--location=global' `
  "--project=$Project" `
  '--format=value(name)').Trim()

if (-not $poolName -or -not $providerName) {
  throw 'The existing ClaimFlow GitHub Workload Identity provider could not be resolved.'
}

$principalSet = "principalSet://iam.googleapis.com/$poolName/attribute.repository/$GitHubRepo"

Invoke-Gcloud iam service-accounts add-iam-policy-binding $serviceAccount `
  "--project=$Project" `
  '--role=roles/iam.workloadIdentityUser' `
  "--member=$principalSet"

Write-Host ''
Write-Host 'RAG acceptance identity configured.'
Write-Host "GCP_RAG_TEST_SERVICE_ACCOUNT=$serviceAccount"
Write-Host "GCP_WORKLOAD_IDENTITY_PROVIDER=$providerName"

$gh = Get-Command gh -ErrorAction SilentlyContinue
if ($gh) {
  & gh auth status --hostname github.com *> $null
  if ($LASTEXITCODE -eq 0) {
    & gh variable set GCP_RAG_TEST_SERVICE_ACCOUNT --repo $GitHubRepo --body $serviceAccount
    if ($LASTEXITCODE -ne 0) { throw 'Failed to set GCP_RAG_TEST_SERVICE_ACCOUNT.' }
    Write-Host 'GitHub repository variable GCP_RAG_TEST_SERVICE_ACCOUNT configured.'
    exit 0
  }
}

Write-Host ''
Write-Host 'GitHub CLI is unavailable or unauthenticated.'
Write-Host 'Add this repository Actions variable manually:'
Write-Host "  GCP_RAG_TEST_SERVICE_ACCOUNT = $serviceAccount"
