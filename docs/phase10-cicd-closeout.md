# Phase 10 — CI/CD and secure deployment closeout

**Status: complete — live exit gate passed.**

## Production deployment path

ClaimFlow now deploys automatically after a successful merge or push to `main`:

```text
pull request
  → quality checks
  → Firestore integration test
  → container smoke test
  → merge to main
  → GitHub OIDC / Workload Identity Federation
  → Cloud Run source build
  → production deployment
  → /health, /ready and web-root verification
```

The workflow is implemented in `.github/workflows/ci.yml`.

## Pull-request gates

The `quality` job runs:

1. `npm ci`;
2. formatting check;
3. ESLint;
4. TypeScript type checking;
5. Vitest test suite;
6. frontend/backend build.

Additional gates run:

- an isolated Firestore emulator integration test;
- a Docker build and packaged-app smoke test without cloud credentials.

The production deploy job depends on all three gates.

## Keyless Google Cloud authentication

GitHub Actions authenticates to Google Cloud with:

- GitHub OIDC;
- Google Workload Identity Federation;
- deployer service account `claimflow-github-deployer@claimflow-ai-agents.iam.gserviceaccount.com`.

No downloadable Google service-account JSON key is stored in the repository or required by the deployment workflow.

The one-time bootstrap is maintained in `scripts/setup-github-cloud-deploy.ps1`. It creates/configures the Workload Identity pool/provider, deployer identity, runtime `actAs` permission, source-build identity permissions and the least set of project roles needed for source deployment.

## Cloud Run production configuration

The automated deployment targets:

- project: `claimflow-ai-agents`;
- region: `australia-southeast1`;
- service: `claimflow-api`;
- runtime service account: `claimflow-api-runtime@claimflow-ai-agents.iam.gserviceaccount.com`;
- Firestore database mode;
- Cloud Storage document mode;
- Vertex AI / Gemini 3.5 Flash extraction;
- same-origin React web application.

The service currently remains publicly invokable for the synthetic-data hackathon demo. Application authentication remains a separate product-hardening task; no real customer information should be entered until that control is added.

## Production verification

After deploy, GitHub Actions verifies:

- `GET /health`;
- `GET /ready`;
- the public web root `/`.

The first verified automatic main-branch deployment completed successfully in GitHub Actions CI run #47 on 13 September 2026 after PR #19. The run demonstrated that a merge to `main` can build and deploy Cloud Run using WIF without stored Google Cloud keys.

## Manual deployment

`scripts/deploy-cloud.ps1` remains only as an emergency/manual fallback. Normal development should use pull requests and automatic main-branch deployment.

## Phase 10 exit gate

**PASS.** A merge to `main` produces a verified Cloud Run deployment after CI gates, using GitHub OIDC + Workload Identity Federation and no stored Google Cloud service-account key.
