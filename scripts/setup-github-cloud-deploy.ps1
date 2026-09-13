# One-time bootstrap for keyless GitHub Actions -> Google Cloud deployment.
# Run from the repository root with an account that can manage project IAM and Workload Identity Federation.
param(
  [string]$Project = 'claimflow-ai-agents',
  [string]$GitHubRepo = 'amin076/claimflow-agent',
  [switch]$SkipWorkflowTrigger
)

$ErrorActionPreference = 'Stop'
$poolId = 'claimflow-github'
$providerId = 'main'
$deployerName = 'claimflow-github-deployer'
$deployer = "$deployerName@$Project.iam.gserviceaccount.com"
$runtime = "claimflow-api-runtime@$Project.iam.gserviceaccount.com"

function Invoke-Gcloud {
  & gcloud @args
  if ($LASTEXITCODE -ne 0) { throw "gcloud failed (exit $LASTEXITCODE): gcloud $args" }
}

function Test-Gcloud {
  & gcloud @args *> $null
  return $LASTEXITCODE -eq 0
}

Write-Host "Configuring keyless GitHub deployment for $GitHubRepo -> $Project"

Invoke-Gcloud services enable `
  run.googleapis.com `
  cloudbuild.googleapis.com `
  artifactregistry.googleapis.com `
  iamcredentials.googleapis.com `
  sts.googleapis.com `
  "--project=$Project"

if (-not (Test-Gcloud iam service-accounts describe $deployer "--project=$Project")) {
  Invoke-Gcloud iam service-accounts create $deployerName `
    "--project=$Project" `
    '--display-name=ClaimFlow GitHub deployer'
}

if (-not (Test-Gcloud iam workload-identity-pools describe $poolId '--location=global' "--project=$Project")) {
  Invoke-Gcloud iam workload-identity-pools create $poolId `
    '--location=global' `
    "--project=$Project" `
    '--display-name=ClaimFlow GitHub Actions'
}

if (-not (Test-Gcloud iam workload-identity-pools providers describe $providerId "--workload-identity-pool=$poolId" '--location=global' "--project=$Project")) {
  Invoke-Gcloud iam workload-identity-pools providers create-oidc $providerId `
    "--workload-identity-pool=$poolId" `
    '--location=global' `
    "--project=$Project" `
    '--issuer-uri=https://token.actions.githubusercontent.com' `
    '--attribute-mapping=google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref' `
    "--attribute-condition=assertion.repository=='$GitHubRepo' && assertion.ref=='refs/heads/main'" `
    '--display-name=ClaimFlow main branch'
}

$projectNumber = (& gcloud projects describe $Project '--format=value(projectNumber)').Trim()
if (-not $projectNumber) { throw 'Could not resolve Google Cloud project number.' }
$poolName = (& gcloud iam workload-identity-pools describe $poolId '--location=global' "--project=$Project" '--format=value(name)').Trim()
$providerName = (& gcloud iam workload-identity-pools providers describe $providerId "--workload-identity-pool=$poolId" '--location=global' "--project=$Project" '--format=value(name)').Trim()
if (-not $poolName -or -not $providerName) { throw 'Could not resolve Workload Identity resource names.' }

$principalSet = "principalSet://iam.googleapis.com/$poolName/attribute.repository/$GitHubRepo"
Invoke-Gcloud iam service-accounts add-iam-policy-binding $deployer `
  "--project=$Project" `
  '--role=roles/iam.workloadIdentityUser' `
  "--member=$principalSet"

foreach ($role in @('roles/run.sourceDeveloper', 'roles/serviceusage.serviceUsageConsumer')) {
  Invoke-Gcloud projects add-iam-policy-binding $Project `
    "--member=serviceAccount:$deployer" `
    "--role=$role" `
    '--condition=None'
}

Invoke-Gcloud iam service-accounts add-iam-policy-binding $runtime `
  "--project=$Project" `
  "--member=serviceAccount:$deployer" `
  '--role=roles/iam.serviceAccountUser'

$buildServiceAccount = "$projectNumber-compute@developer.gserviceaccount.com"
Invoke-Gcloud projects add-iam-policy-binding $Project `
  "--member=serviceAccount:$buildServiceAccount" `
  '--role=roles/run.builder' `
  '--condition=None'

Write-Host ''
Write-Host 'Google Cloud bootstrap complete.'
Write-Host "GCP_WORKLOAD_IDENTITY_PROVIDER=$providerName"
Write-Host "GCP_DEPLOY_SERVICE_ACCOUNT=$deployer"

$gh = Get-Command gh -ErrorAction SilentlyContinue
$variablesConfigured = $false
if ($gh) {
  & gh auth status --hostname github.com *> $null
  if ($LASTEXITCODE -eq 0) {
    & gh variable set GCP_WORKLOAD_IDENTITY_PROVIDER --repo $GitHubRepo --body $providerName
    if ($LASTEXITCODE -ne 0) { throw 'Failed to set GCP_WORKLOAD_IDENTITY_PROVIDER with gh.' }
    & gh variable set GCP_DEPLOY_SERVICE_ACCOUNT --repo $GitHubRepo --body $deployer
    if ($LASTEXITCODE -ne 0) { throw 'Failed to set GCP_DEPLOY_SERVICE_ACCOUNT with gh.' }
    $variablesConfigured = $true
    Write-Host 'GitHub repository variables configured.'
  }
}

if (-not $variablesConfigured) {
  Write-Host ''
  Write-Host 'GitHub CLI is missing or not authenticated. Add these two repository Variables manually:'
  Write-Host "  GCP_WORKLOAD_IDENTITY_PROVIDER = $providerName"
  Write-Host "  GCP_DEPLOY_SERVICE_ACCOUNT    = $deployer"
  Write-Host 'Path: GitHub repository -> Settings -> Secrets and variables -> Actions -> Variables.'
  Write-Host 'Then run the CI workflow once from GitHub Actions (Run workflow on main).'
  exit 0
}

if (-not $SkipWorkflowTrigger) {
  & gh workflow run ci.yml --repo $GitHubRepo --ref main
  if ($LASTEXITCODE -ne 0) { throw 'GitHub variables are configured, but triggering CI failed.' }
  Write-Host 'Triggered CI on main. After all test jobs pass, deploy-cloud-run will deploy production automatically.'
}
