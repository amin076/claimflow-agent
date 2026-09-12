# Phases 4–5: cloud persistence and private deployment

[فارسی](./cloud-deployment.fa.md)

## What is implemented

- A selectable Firestore repository and local in-memory repository use the same deterministic workflow.
- Case metadata, fields, issues, reviews, agent runs and audit history are committed atomically in a Firestore `cases/{id}` document. The `payload` field is a JSON string, with an `updatedAt` field for ordering. Original bytes are stored only in GCS or the local uploads directory.
- Firestore transactions retry concurrent changes; transaction callbacks never upload files or call models. Case references use UUIDs rather than a process-local counter.
- The aggregate has a 700 KB UTF-8 limit and the cloud list shows the latest 100 cases. Subcollections and pagination are future scale work. An oversized aggregate is rejected before write. Do not use this bounded demo design for unbounded production history.
- Upload one synthetic PDF, JPEG or PNG (5 MiB maximum) through `POST /api/cases/:id/uploads?type=CLAIM_FORM`, using a multipart `file` field. The backend checks file signatures and assigns all storage paths; it never trusts a client-provided storage URI. These checks do not constitute malware scanning.
- Retrieve original bytes through `GET /api/cases/:id/documents/:documentId/content`. Files remain private, with no signed URLs or browser GCS CORS requirement.
- Metadata-only registration remains for local Phase 3 compatibility, but is disabled in GCS mode.
- `GET /health` checks the process; `GET /ready` checks configured Firestore/GCS access.
- One container serves React and the API from the same origin. Cloud Run IAM protects the entire service. There is no application-level user isolation yet; all authorized testers share the synthetic workspace, and reviewer names are self-reported labels.
- `AI_MODE=mock` remains mandatory. Uploaded bytes are **not** inspected by the mock extractor; its values and evidence are synthetic fixtures. Vertex/Gemini comes in Phase 6.

## Verification status

Implementation and local tests are available. CI includes a real Firestore emulator test for persistence across clients and concurrent audit writes, plus a Docker build and packaged full-workflow smoke test. Live project IAM, GCS operations and Cloud Run persistence must be verified using the steps below before Phases 4–5 can be called operationally complete.

## Local run

Stop existing dev servers before `npm ci` on Windows.

```powershell
npm ci
npm run dev
```

The defaults remain `DATABASE_MODE=memory`, `STORAGE_MODE=local`, `AI_MODE=mock`. Local file bytes survive restart, but in-memory case metadata does not. The app reads process environment variables; `.env.example` is a template and is not automatically loaded by the current server command.

## Cloud prerequisites

Already reported created in project `claimflow-ai-agents`, Sydney (`australia-southeast1`):

| Resource | Name |
|---|---|
| Firestore Native | `(default)` |
| Private bucket | `claimflow-ai-agents-documents` |
| Docker repository | `claimflow-containers` |
| Runtime identity | `claimflow-api-runtime@claimflow-ai-agents.iam.gserviceaccount.com` |

Runtime access: project `roles/datastore.user`, project `roles/logging.logWriter`, bucket-scoped `roles/storage.objectUser`. No key files. Cloud Run uses its service identity and Application Default Credentials.

The deployer's own Google identity needs permission to submit builds, deploy Cloud Run, and act as the runtime service account. The project's actual Cloud Build execution identity needs Artifact Registry write and log access, plus access to the source staging bucket. These are separate from runtime roles. The deployment script stops on a permission error; inspect the actual missing permission instead of granting Owner or Editor. Build identity configuration was not verified in this session.

## Build and deploy from PowerShell

After the PR passes CI and the local checkout contains the merged code:

```powershell
git switch main
git pull origin main
npm ci
npm run typecheck
npm test
npm run build
.\scripts\deploy-cloud.ps1
```

The script preflights existing resources, builds a commit-tagged image with Cloud Build, and deploys a **private** Cloud Run service with 0 minimum / 1 maximum instance, 512 MiB RAM and 20 request concurrency. Builds and storage may incur costs; a maximum instance setting is not a spending cap. It creates no downloadable credentials and enables no AI APIs. Cloud Run deployment is user-authorized but remains unverified until this command runs successfully with the user's Google identity.

## Verify the deployed service

In a separate terminal:

```powershell
gcloud run services proxy claimflow-api --project=claimflow-ai-agents --region=australia-southeast1 --port=8081
```

Then:

```powershell
node scripts/smoke.mjs http://localhost:8081
```

Open `http://localhost:8081` to test the UI. The script checks health, readiness, UI, create, upload, byte-for-byte download, process, review and audit. It prints a case ID and document URI. In cloud mode the URI must start with `gs://claimflow-ai-agents-documents/`.

Redeploy the same image to a new revision (or change a harmless revision environment marker), reconnect the proxy and request the printed `verifyAfterRestart` URL. Confirm the case, document download, review and four audit events still exist. Record the service URL, revision and smoke output. This is the remaining live exit gate.

Behzad can perform final review after receiving Cloud Run Invoker access through his own Google identity. Do not make the service public to bypass sign-in.

## Failure handling and recovery

- A GCS failure returns an error before document metadata is added.
- GCS and Firestore cannot share a transaction. If the metadata write fails after upload, the object is retained and a reconciliation message with its generated key is logged. A Firestore timeout may hide a successful commit, so automatic deletion could destroy valid evidence. Inspect the case and logs before retrying or removing an unreferenced object. There is no automatic orphan cleanup or upload idempotency yet.
- Production startup refuses memory/local persistence and unsupported AI modes instead of silently losing cases.
- A readiness failure returns 503 without exposing dependency details.
- Before changing an existing deployed service, record its current ready revision. To roll back, use `gcloud run services update-traffic claimflow-api --to-revisions=PREVIOUS_REVISION=100 --region=australia-southeast1 --project=claimflow-ai-agents`. Inspect revision names first; never delete the database or bucket as a recovery step.

## Sources

- [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Cloud Run container contract](https://docs.cloud.google.com/run/docs/container-contract)
- [Cloud Run service identity](https://docs.cloud.google.com/run/docs/configuring/services/service-identity)
- [Invoke a private Cloud Run service](https://docs.cloud.google.com/run/docs/triggering/https-request)
