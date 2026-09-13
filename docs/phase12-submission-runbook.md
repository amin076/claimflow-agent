# Phase 12 — Demo and submission runbook

Status: **submission-ready application; final recording and hackathon form upload remain**

Date: 2026-09-13

## Goal

Turn the verified ClaimFlow build into a concise, reproducible hackathon submission without adding risky last-minute product scope.

## Freeze line

From this point until submission:

- do not add a new cloud service unless it fixes a demonstrated blocker;
- do not add Document AI, ElevenLabs, authentication, queues, or a second insurance product;
- prioritize correctness, demo clarity, screenshots, recording, README consistency, and submission completeness;
- use synthetic/redacted data only.

## Production baseline

The verified production baseline is merge commit:

`d77d45a23233c7a33ebdf9f23ed15964003b1b46`

GitHub Actions run #56 passed all quality gates and automatically deployed to Cloud Run with GitHub OIDC/Workload Identity Federation. The deploy job verified the production health, readiness, and web endpoints.

## Final pre-recording check

Run one fresh synthetic case and confirm:

1. the application loads from the production URL;
2. runtime mode shows Gemini/Vertex rather than mock mode;
3. the five-page synthetic packet uploads successfully;
4. all six workflow stages complete;
5. extracted fields show page-linked evidence;
6. `incident.date` displays a conflict between `2026-09-10` and `2026-09-11`;
7. `damage.estimatedAmount` displays a conflict between `AUD 4,860.00` and `AUD 4,142.00`;
8. both conflicts display **Conflict detected** and a `CONTRADICTION` issue;
9. **Accept value** is disabled for conflicted fields;
10. entering a canonical correction plus review reason succeeds;
11. the audit timeline records the workflow and human decision;
12. no UI text claims that ClaimFlow automatically approves or denies claims.

If these checks pass, stop changing the core workflow.

## Recommended 2–3 minute video script

### 0:00–0:20 — Problem

"Businesses in claims, restoration and field service receive important facts across messy PDFs, photos, handwritten forms and emails. OCR can copy text, but teams still have to reconcile uncertainty and contradictions manually."

### 0:20–0:40 — Product

"ClaimFlow AI turns those documents into an evidence-linked case. It uses Gemini on Vertex AI inside a controlled ADK workflow, then deterministic TypeScript rules decide what must be reviewed by a person."

### 0:40–1:05 — Live processing

Create a fresh case, upload the synthetic packet, and start extraction. Show the workflow stages briefly.

### 1:05–1:35 — Evidence

Show one or two clean fields. Point out confidence, page-linked source evidence, and the original document link.

### 1:35–2:15 — Main differentiator

Show the date conflict and amount conflict.

"ClaimFlow does not silently pick one answer. It preserves both source values, marks a contradiction, disables simple acceptance, and requires the reviewer to inspect evidence and record one canonical correction with a reason."

### 2:15–2:35 — Human control and audit

Save a correction and show the audit timeline.

"Every agent step and human correction is traceable. The system prepares the case; it does not make the insurance decision."

### 2:35–3:00 — Architecture and close

Show or narrate:

`React → Fastify → Cloud Storage / Firestore → ADK → Gemini on Vertex AI → deterministic rules → human review`

End with the business value: faster case preparation while keeping uncertainty visible and people in control.

## Submission description draft

### One-line description

ClaimFlow AI is an evidence-first agentic document workflow that turns messy claims paperwork into structured, source-linked cases while detecting uncertainty and routing contradictions to human review.

### Problem

Claims, restoration, insurance and field-service teams receive important information through inconsistent PDFs, photos, forms, notes and emails. Staff must manually transcribe and reconcile facts, which is slow and makes contradictions easy to miss.

### Solution

ClaimFlow ingests synthetic documents, stores originals privately, uses Gemini on Vertex AI for multimodal extraction, validates structured output with Zod, coordinates processing through Google ADK, applies deterministic business rules, and presents uncertain values with their source evidence in a human-review workspace.

The key design choice is that uncertainty remains visible. Conflicting dates or amounts are not silently resolved by the model. ClaimFlow creates a contradiction, shows the cited source pages, and requires a reviewer to record the supported canonical value and reason.

### What is agentic

The backend runs a controlled six-stage workflow:

1. Intake
2. Quality
3. Extraction
4. Validation
5. Case planning
6. Review routing

Agents interpret and plan, while ordinary services handle persistence, schemas, deterministic checks and state transitions. This keeps the workflow explainable and prevents the LLM from owning consequential business rules.

### Google Cloud / AI technologies

- Gemini 3.5 Flash on Vertex AI
- Google Agent Development Kit (ADK)
- Cloud Run
- Firestore
- Cloud Storage
- Cloud Logging
- GitHub Actions with Google Workload Identity Federation / OIDC

### Responsible-use boundary

ClaimFlow is a hackathon prototype for case preparation, not an autonomous insurance decision system. It uses synthetic/redacted inputs and does not approve or deny claims, determine liability, or contact real customers automatically.

## Suggested technology tags

Use only tags supported by the hackathon form, prioritizing:

- Agentic AI
- Google Cloud
- Vertex AI
- Gemini
- Google ADK
- Cloud Run
- Firestore
- TypeScript
- React
- Human-in-the-loop
- Document intelligence

## Screenshot set

Capture at least these four frames:

1. **Overview / workflow** — case workspace with workflow status and extracted fields.
2. **Date contradiction** — `incident.date`, two source pages, `Conflict detected`, canonical-value input.
3. **Amount contradiction** — `damage.estimatedAmount`, both source amounts, contradiction warning.
4. **Audit timeline** — successful agent stages and case processing / human review history.

Optional fifth frame: architecture diagram or deployment/CI evidence.

## Judge question preparation

### Why is this better than OCR?

OCR returns text. ClaimFlow creates a typed case, preserves evidence lineage, checks deterministic rules, surfaces contradictions, routes uncertainty, and records human decisions.

### Why use agents instead of one large prompt?

The staged workflow makes responsibilities and failures visible. Quality, extraction, validation, planning and review routing can be inspected separately, while deterministic code retains authority over business rules and state transitions.

### What happens when Gemini is wrong?

Model output is untrusted. It is schema-validated, checked against source evidence and deterministic rules, and consequential/uncertain values remain in human review. Invalid output fails closed instead of corrupting the case.

### Why not use Document AI?

The five-page live benchmark was successfully processed by Gemini multimodal extraction with page-linked evidence and deliberate conflicts preserved. Document AI was evaluated and deferred until harder handwriting, blurry-scan or layout benchmarks show a measurable improvement worth the extra service complexity.

### How would this become production-ready?

Add authenticated reviewer identity and authorization, broader evaluation datasets, malware/file scanning, production queues and retry policy, monitoring/SLOs, formal privacy/compliance controls, and domain-specific integrations with the existing case-management system.

### What is the key safety feature?

ClaimFlow does not let the LLM silently resolve conflicting source evidence or approve/deny a claim. Conflicts require a human-supported canonical correction and are recorded in the audit history.

## Final submission checklist

- [x] Core application implemented
- [x] Gemini live extraction verified
- [x] ADK workflow verified
- [x] Evidence-linked fields verified
- [x] Human-review correction flow verified
- [x] Same-document date/amount conflicts verified live
- [x] Safe failure paths covered by tests
- [x] Firestore and Cloud Storage persistence implemented
- [x] Keyless CI/CD implemented and production deploy verified
- [x] Document AI decision documented
- [x] Phase 11 evaluation evidence documented
- [ ] Final README/status cleanup merged
- [ ] Fresh production run immediately before recording
- [ ] Final 2–3 minute video recorded
- [ ] Final screenshots saved
- [ ] Hackathon submission text pasted and checked
- [ ] Production URL and GitHub repository linked
- [ ] Final submission confirmation captured

## Stop condition

Once the fresh production run matches the expected date and amount conflict behavior, do not change the core extraction/review logic before recording unless a blocking bug is discovered.
