# Phase 11 — Observability and evaluation closeout

Status: **complete for the hackathon MVP**

Date: 2026-09-13

## Objective

Phase 11 proves that ClaimFlow does not only work on the happy path. It records what the workflow did, preserves evidence and uncertainty, and fails closed when the model, document, or reviewer state is unsafe.

## Observability already implemented

Every persisted `AgentRun` can record:

- workflow/agent name;
- status (`QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, `SKIPPED`);
- start and completion timestamps;
- model and model version;
- prompt version;
- input/output/total token usage;
- duration;
- input/output references;
- safe error summary.

Cases also persist validation issues, reviews, and audit events. The UI exposes the six workflow stages and the audit timeline so a reviewer can understand what happened without relying on hidden model state.

## Automated evaluation evidence

The automated suite verifies the following safety and reliability scenarios.

| Scenario | Expected behavior | Evidence in automated tests |
|---|---|---|
| Successful extraction | Six workflow stages succeed, trace/model usage persists, case remains human-reviewable | `workflow.test.ts` verifies all six stages, model/version/token metadata, audit event, and single model invocation |
| Invalid/malformed model output | Fail closed; no corrupt fields; later stages skipped; human review required | invalid JSON, foreign evidence references, and forbidden extra output are rejected |
| Truncated or safety-stopped model response | Reject incomplete completion | `MAX_TOKENS` and `SAFETY` completion paths are rejected |
| Concurrent processing | Do not double bill or allow review while extraction is running | duplicate process call and review are blocked |
| Model timeout | Abort once, record safe failure, do not loop retries | timeout test verifies abort signal and `MODEL_TIMEOUT` issue |
| Interrupted execution | Recover without another model call | stale processing recovery is tested |
| Late result after recovery | Reject stale write | late provider completion cannot overwrite recovered case |
| Oversized PDF | Reject before model invocation | six-page packet is rejected by page budget |
| Unreadable document | Do not invent values; route to input/review | unreadable response produces `DOCUMENT_QUALITY` and no fields |
| Invalid/future date | Deterministic rules block `READY` | invalid calendar date and future date are rejected |
| Cross-document contradiction | Acceptance alone cannot resolve conflict; correction required | conflicting vehicle registrations remain open until reasoned correction |
| Missing field | Human correction requires valid evidence from the case | foreign/no evidence is rejected; supported evidence is accepted |
| Rejected field | Never treat rejection as `READY` | rejection routes case to `NEEDS_INPUT` |

## Live Vertex/Gemini acceptance evidence

A live five-page synthetic packet was processed in the deployed Cloud Run application with Gemini on Vertex AI and the ADK workflow.

Observed results:

- all six workflow stages completed;
- 11 supported fields were extracted;
- source evidence linked to the correct pages;
- `incident.date` preserved a deliberate conflict between `2026-09-10` and `2026-09-11`;
- `damage.estimatedAmount` preserved a deliberate conflict between `AUD 4,860.00` and `AUD 4,142.00`;
- both conflicting fields were labelled **Conflict detected**;
- deterministic issues were classified as `CONTRADICTION` rather than misleading format errors;
- `Accept value` was disabled for conflicted fields;
- the reviewer UI required one canonical correction plus a review reason;
- the audit timeline showed successful `REVIEW_ROUTER` completion and case processing.

This is the required live proof that the system can surface disagreement instead of silently choosing one model interpretation.

## CI evidence

GitHub Actions run #56 on merge commit `d77d45a23233c7a33ebdf9f23ed15964003b1b46` passed:

- formatting;
- lint;
- TypeScript type checking;
- automated tests;
- application build;
- container build and smoke test;
- Firestore integration test;
- GitHub OIDC/WIF authentication;
- Cloud Run deployment;
- production `/health`, `/ready`, and web verification.

## Evaluation conclusion

ClaimFlow meets the Phase 11 exit gate for the hackathon MVP: both success and safe-failure paths have automated evidence, and the production system has live evidence for multimodal extraction, source-linked conflicts, deterministic validation, human review, auditability, and verified deployment.

## Known limitations kept explicit

- synthetic/redacted data only;
- no autonomous claim approval or denial;
- no production identity/authentication layer for reviewer attribution;
- no distributed queue or production-scale retry system;
- Document AI is deferred until a handwriting/blurry/layout benchmark demonstrates material benefit;
- current extraction quality is demonstrated on the hackathon packet, not claimed as a general production accuracy benchmark.
