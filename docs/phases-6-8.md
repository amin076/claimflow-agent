# Phases 6–8: Gemini extraction, ADK workflow and human review

[فارسی](./phases-6-8.fa.md)

## Status and evidence

Phases 4–5 live exit gate passed, based on Amin's supplied deployment/test output:

- Cloud Run `claimflow-api-00002-klk` receives 100% traffic.
- Existing case `case-379cf6dc-d2f2-4df7-95f6-d78818260747` survived the revision change, with 1 document, 1 review and 4 audit events.
- Original document `doc-ad732643-e083-449c-a6f1-223a56dec05c` was retrieved with HTTP 200 and 50 bytes after the revision change.

Phases 6–8 are implemented with automated tests. **Live Gemini execution in this project remains an exit gate until the deployment and acceptance command below passes.** Local and CI tests use a controlled provider; they do not establish OCR accuracy or live model access.

## Runtime architecture

Google ADK 2.0 `Workflow` coordinates six custom `BaseAgent` steps under an ephemeral `InMemoryRunner`. Durable records are written through the case repository. The same ADK workflow supports a deterministic mock provider and the Google Gen AI SDK Vertex provider. A legacy metadata-only local route remains for Phase 3 API compatibility.

| Step | Implementation | Recorded result |
|---|---|---|
| Intake | Load server-owned original file paths | Input document IDs and step status |
| Quality | Check file signatures, PDF readability and aggregate budgets | Failure or successful preflight |
| Extraction | One Gemini request containing all sources; strict JSON parsing | Model, prompt version, duration, usage when available |
| Validation | Deterministic rules and source-reference validation | Evidence-linked fields and issues |
| Case planner | Summarize field/document/issue counts and next action | Case summary |
| Review router | Route incomplete/uncertain results to a human | NEEDS_INPUT or NEEDS_REVIEW |

The quality step checks structural usability; the extraction response also supplies a combined model quality assessment. It is not a separate calibrated vision-quality classifier. Each step is recorded before and after execution, with failed/skipped states on errors. UI polling shows active progress.

## Bounded extraction

- Up to 3 current source documents, 5 pages total, 5 MiB per upload and 10 MiB total.
- One SDK request per workflow; SDK attempts=1 and no automatic model fallback/retry.
- 40-second model timeout by default, configurable up to 45 seconds; 8192 output-token cap including model generation limits.
- Source files are sent as inline data, with server-supplied document IDs. No user-supplied URLs, web tools, code execution or claim-decision tools are exposed to the model.
- Zod rejects unknown properties, duplicate same-document fields, fabricated document IDs, invalid pages, inconsistent missing-field declarations, malformed JSON, blocked or truncated output.
- Confidence and quoted evidence are **model assertions**, not verified probabilities or independently checked OCR. Human verification remains required for every proposed field. The live fixture test additionally compares quoted excerpts with known source text.
- A Firestore transaction claims the workflow before a model call. Duplicate/concurrent processing receives 409. Model requests never run inside Firestore transaction callbacks.
- Completed and failed cases do not automatically rerun. Replace a source explicitly or create a new case for another run; a new run can incur another charge.
- After interruption, `POST /api/cases/:id/recover-processing` can release a run older than two minutes into human review. It never calls the model. Late results cannot overwrite the recovered state.

## Rules and review

Required baseline values: claimant name, incident date, incident address and damage description.

Rules cover missing/rejected values, confidence below 80%, unreviewed fields, conflicting values across documents, valid calendar dates, future dates, email syntax, non-negative numeric damage amounts, and unusable sources. Registration comparison ignores spacing/punctuation and letter case.

The UI shows all evidence entries and links to original source downloads with page labels. Review actions require a reason. An absent field can be corrected only with a source document, valid page and excerpt. Contradictions require an explicit correction: accepting a conflicting proposal does not resolve the issue. Rejecting a required field creates a missing-value issue.

After each review the backend recomputes rules and the case plan, preserving review/audit history and resolving superseded rule issues. Correcting a date to an invalid/future date cannot produce READY. READY means evidence preparation is complete; it is never insurance claim approval.

Replacing a source through `uploads?type=...&replaceId=...` moves the old source metadata into `supersededDocuments`, preserves the original file and review/audit history, clears stale extracted fields/issues and returns the case to DRAFT. Processing must be explicitly started again. Failed extraction issues cannot be dismissed by field acceptance.

## Deploy in Vertex mode

From a clean, merged checkout in PowerShell (stop old dev servers before npm ci):

```powershell
git switch main
git pull origin main
npm ci
.\scripts\deploy-cloud.ps1 -AiMode vertex
```

This enables `aiplatform.googleapis.com` and grants the existing runtime service account `roles/aiplatform.user`, then builds and deploys the combined app. It preserves private invocation and durable adapters. No service-account key is created.

Defaults: `GEMINI_MODEL=gemini-3.5-flash`, `VERTEX_LOCATION=global`, model timeout 40 seconds. Storage and Firestore remain in Sydney. **Global model processing is not an Australia-only data-residency guarantee.** This application remains restricted to synthetic documents. Model/location can be changed with `-GeminiModel` and `-VertexLocation`; verify availability for the chosen combination first.

Deployment uses 0 minimum / 1 maximum instance, 1 GiB memory, 4 concurrent requests and a 120-second request timeout. These settings and request budgets reduce exposure but are not a monetary spending cap. Existing billing budgets/policies still apply. `-AiMode mock` redeploys without live model calls.

## Live acceptance gate

Start the authenticated proxy:

```powershell
gcloud run services proxy claimflow-api --project=claimflow-ai-agents --region=australia-southeast1 --port=8081
```

In another terminal:

```powershell
node scripts/smoke-vertex.mjs http://localhost:8081
```

The script creates a genuine one-page synthetic PDF in memory with Maya Rivera, registration SYN-482 and date 2026-09-10; uploads it, invokes one model request, checks known values and source excerpts, verifies six successful ADK steps, then tests review → READY → invalid future-date correction → blocked → valid correction → READY. The test harness labels its review actions as synthetic automation; it does not impersonate a human reviewer. Output includes the new case ID and usage. No real customer data is involved.

The previous `smoke.mjs` now checks mock mode specifically. Never use a mock PASS as proof of Gemini extraction.

Final UI acceptance with Amin/Behzad: inspect a conflicting registration across two synthetic sources, unreadable-source routing, evidence-backed missing-field correction, replacing a source and visible audit/step progress. Automated tests cover these deterministic paths, but real model accuracy on diverse handwriting remains future evaluation work.

## Recovery and limitations

- Safe error categories identify access/API problems, unavailable model/source, rate limiting, timeout or invalid output. Raw provider error text and model responses are not sent to the UI or deliberately logged.
- Cloud readiness checks persistence, not a paid model request. A green `/ready` does not prove Vertex access; use the live acceptance gate.
- PDF page count is checked using pdf-lib; image inputs count as one page. File signature checks are not malware scanning.
- IAM protects the shared synthetic workspace; reviewer IDs remain self-reported labels, not authenticated application identities. Multi-tenant access control and real customer-data approval remain outside these phases.
- ADK sessions are ephemeral; interrupted runs are recovered into human review, not resumed halfway. The Firestore case ledger is durable. No distributed job queue is claimed.
- Historical aggregate limits (700 KB stored, 500 KB maximum before starting a new extraction) remain. The cloud list returns the latest 100 cases.
- Old objects retained after ambiguous upload failures require reconciliation; automatic orphan cleanup is still deferred.

## Primary references

- [Google Gen AI SDK](https://github.com/googleapis/js-genai)
- [ADK TypeScript](https://github.com/google/adk-js)
- [Gemini 3.5 Flash](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-5-flash)
- [Model locations](https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/locations)
- [Data residency](https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/data-residency)
