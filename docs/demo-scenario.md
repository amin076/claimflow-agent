# Demo Scenario

## Synthetic motor-claim case

The official hackathon demo uses a fully synthetic five-page motor-claim packet. It intentionally contains both consistent facts and conflicting facts so ClaimFlow can demonstrate evidence lineage, multimodal extraction, deterministic validation, human review, approval-gated voice clarification, and auditability in one short flow.

The packet contains fictional claimant/contact details, incident information, vehicle information, damage notes, and estimate information. All people, addresses, identifiers, phone numbers, dates, and amounts are synthetic.

Two deliberate conflicts are important for the live demo:

- incident date: `2026-09-10` versus `2026-09-11`;
- estimated damage amount: `AUD 4,860.00` versus `AUD 4,142.00`.

The strongest production-verified flow uses the incident date contradiction and resolves it through a human-approved ElevenLabs call.

## Recommended 2–3 minute walkthrough

### 0:00–0:20 — Problem

Explain that claims, restoration, and field-service teams receive facts across PDFs, photos, emails, notes, and forms. A plain OCR system can copy text, but it does not reliably show where each fact came from, surface contradictions, or know when a person must intervene.

### 0:20–0:45 — Create and process the case

Create a new synthetic case, upload the five-page packet, and run **Extract with Gemini**. Point out that the backend executes the controlled six-stage ADK workflow and stores originals separately from structured case data.

### 0:45–1:10 — Evidence-linked extraction

Show one or two correctly extracted fields and their page-linked evidence. Keep this fast; the central demo is the contradiction workflow.

### 1:10–1:35 — Conflict detected

Scroll to `incident.date`.

Show that ClaimFlow:

- preserves `2026-09-10` and `2026-09-11`;
- displays **Conflict detected**;
- creates a `CONTRADICTION` issue;
- disables simple acceptance;
- requires a human-supported canonical correction.

Narration:

> “ClaimFlow does not silently choose which document is right. It keeps both values and asks for human resolution.”

### 1:35–2:15 — Human-approved ElevenLabs clarification

Open **Voice clarification · ElevenLabs**.

1. Enter the reviewer key privately before recording or paste it off-camera.
2. Click **Call for clarification: incident.date**.
3. Show the editable question and candidate values.
4. Explain that Gemini may improve the wording, but if optional drafting is unavailable, ClaimFlow keeps a safe deterministic template rather than failing the workflow.
5. Click **Approve question**.
6. Click **Start ElevenLabs call** exactly once.
7. Answer the configured synthetic test phone. A Twilio Trial may ask the participant to press a key before the agent begins.
8. Answer with `2026-09-11`.
9. Let the ElevenLabs agent confirm the answer and end the call automatically.

Narration:

> “The reviewer approves the exact wording before any external contact. The browser cannot choose an arbitrary destination; the demo is restricted to one configured consenting participant.”

### 2:15–2:45 — Transcript is evidence, not authority

Return to ClaimFlow and click **Refresh call status**.

Show:

- `COMPLETED` clarification state;
- received timestamp;
- signed transcript evidence;
- the participant answer;
- the warning that machine transcription is not a verified fact.

Point out that `incident.date` is **still not automatically changed**.

Enter:

- final canonical value: `2026-09-11`;
- reason: `Confirmed by the synthetic claimant during the ElevenLabs clarification call.`

Save the human canonical correction.

### 2:45–3:00 — Resolution, audit, close

Show:

- `incident.date · RESOLVED`;
- `Resolved by human` on the corrected field;
- original document evidence retained;
- clarification transcript retained as supporting evidence;
- audit timeline.

Close with:

> “ClaimFlow uses agents to extract, plan and communicate, but deterministic code and explicit human actions control consequential state changes. It prepares the case; it does not approve or deny the claim.”

## Short fallback recording plan

If a live phone call would make the final video too long or risky:

1. record the full successful live call acceptance separately as evidence;
2. in the final 2–3 minute edit, show the approved-question screen, a brief cut to the real ringing/agent call, then the returned transcript and resolved field;
3. do not fake or simulate the transcript if the submission requires a real integration claim.

The project already has a successful production E2E call acceptance documented in [ElevenLabs production E2E acceptance](elevenlabs-live-acceptance.md).

## Claims the demo can prove

- deployed end-to-end processing on Google Cloud Run;
- Gemini multimodal extraction on Vertex AI;
- six-stage ADK workflow execution;
- evidence lineage to source pages;
- explicit model confidence and uncertainty;
- deterministic contradiction and business-rule checks;
- safe deterministic clarification fallback when optional Gemini wording is unavailable;
- explicit reviewer approval before external communication;
- real ElevenLabs/Twilio outbound clarification call to a configured synthetic participant;
- HMAC-verified post-call transcript returned as evidence;
- no automatic transcript-to-field mutation;
- human canonical correction with mandatory reason;
- clarification `RESOLVED` only after deterministic revalidation;
- audit history and agent-run trace;
- Firestore/Cloud Storage persistence;
- automatic keyless GitHub Actions deployment using OIDC/WIF.

## Claims the demo must not make

- perfect handwriting or OCR accuracy;
- autonomous insurance decisions;
- autonomous customer-contact campaigns;
- ability to dial arbitrary phone numbers from the UI;
- production identity/authentication based on the reviewer key;
- production compliance certification;
- measured business savings without a benchmark;
- general production accuracy beyond the tested synthetic scenarios;
- Document AI integration (it was evaluated and deliberately deferred for the MVP).

## Recording guidance

- Use only synthetic data and keep private credentials/reviewer key out of the recording.
- Record a clean fresh case rather than reusing a case with unrelated review actions.
- Keep browser zoom so field name, value, evidence, and status badge are visible together.
- Spend more time on the date conflict + voice clarification than on ordinary fields.
- Do not show the participant's real phone number, Twilio credentials, Secret Manager values, API key, webhook secret, or reviewer key.
- If the Twilio Trial preamble occurs, either keep one brief moment for transparency or cut dead time while preserving that a real call occurred.
- Capture the final `RESOLVED` state and audit timeline as still screenshots.
- Preserve a local copy of the final video and acceptance screenshots as fallback evidence.
