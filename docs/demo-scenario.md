# Demo Scenario

## Synthetic motor-claim case

The official hackathon demo uses a fully synthetic five-page motor-claim packet. It intentionally contains both consistent facts and conflicting facts so ClaimFlow can demonstrate evidence lineage, multimodal extraction, deterministic validation, human review, and auditability in one short flow.

The packet contains fictional claimant/contact details, incident information, vehicle information, damage notes, and estimate information. All people, addresses, identifiers, phone numbers, dates, and amounts are synthetic.

Two deliberate conflicts are important for the live demo:

- incident date: `2026-09-10` versus `2026-09-11`;
- estimated damage amount: `AUD 4,860.00` versus `AUD 4,142.00`.

## Recommended 2–3 minute walkthrough

### 0:00–0:25 — Problem

Explain that claims and restoration teams receive facts across PDFs, photos, emails, notes, and forms. A plain OCR system can copy text, but it does not reliably show where each fact came from, surface contradictions, or know when a person must intervene.

### 0:25–0:50 — Create and process the case

Create a new synthetic case, upload the five-page packet, and run **Extract with Gemini**. Point out that the backend executes the controlled ADK workflow and stores the originals separately from structured case data.

### 0:50–1:25 — Evidence-linked extraction

Show several correctly extracted fields such as claimant phone, incident address, vehicle information, and damage description. Open the source links and point to page-level evidence and model confidence.

### 1:25–2:05 — Genuine conflict handling

Scroll to `incident.date` and `damage.estimatedAmount`.

Show that ClaimFlow:

- preserves both conflicting source values;
- displays **Conflict detected**;
- creates a `CONTRADICTION` issue;
- lowers confidence rather than silently choosing one value;
- disables **Accept value** for the conflict;
- requires a human to inspect the cited evidence and enter one canonical correction with a reason.

This is the central demo moment.

### 2:05–2:35 — Human correction and auditability

Enter one supported canonical value, add the review reason, and save the correction. Show that deterministic rules recompute and that the audit timeline records the human decision and workflow stages.

### 2:35–3:00 — Architecture and safety close

Summarize the stack:

`React → Fastify → Cloud Storage / Firestore → ADK → Gemini on Vertex AI → deterministic TypeScript rules → human review`

Close with the safety boundary: ClaimFlow prepares evidence and a reviewable case; it does not approve or deny an insurance claim.

## Claims the demo can prove

- deployed end-to-end processing on Google Cloud Run;
- Gemini multimodal extraction on Vertex AI;
- six-stage ADK workflow execution;
- evidence lineage to source pages;
- explicit model confidence and uncertainty;
- deterministic contradiction and business-rule checks;
- human correction with mandatory reason;
- audit history and agent-run trace;
- Firestore/Cloud Storage persistence;
- automatic keyless GitHub Actions deployment using OIDC/WIF.

## Claims the demo must not make

- perfect handwriting or OCR accuracy;
- autonomous insurance decisions;
- production compliance certification;
- measured business savings without a benchmark;
- general production accuracy beyond the tested synthetic scenarios;
- Document AI integration (it was evaluated and deliberately deferred for the MVP).

## Recording guidance

- Record a clean fresh case rather than reusing a case that already contains review actions.
- Keep the browser zoom so field name, value, evidence, and conflict badge are visible together.
- Spend more time on the two conflicts than on ordinary fields.
- Do not wait through unnecessary scrolling in the final edit.
- Preserve a local copy of the final video and the four conflict/audit screenshots as fallback evidence.
