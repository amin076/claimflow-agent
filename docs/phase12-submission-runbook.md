# Phase 12 — Demo and submission runbook

Status: **submission-ready application; final recording and form submission remain**

Date: 2026-09-14

## Goal

Turn the verified ClaimFlow build into a concise, reproducible hackathon submission without adding risky last-minute scope.

## Freeze line

From this point until submission:

- do not add a new cloud service or external provider unless it fixes a demonstrated blocker;
- do not redesign the extraction or voice architecture;
- do not add Document AI, production authentication, queues, or a second insurance product;
- only accept small fixes that improve correctness, judge clarity, security, or recording reliability;
- prioritize screenshots, recording, README consistency, submission completeness, and evidence preservation;
- use synthetic/redacted data only.

ElevenLabs is no longer “future scope”: the human-approved voice clarification loop is implemented and production E2E live verified.

## Production acceptance baseline

The live voice acceptance baseline is merge commit:

`adf9664a0b3b11c9948cb6ffa3236ec1c83598a9`

GitHub Actions run `#66` passed quality, Firestore integration, container smoke, OIDC/WIF authentication, Cloud Run deployment, public health/readiness, stable URL verification, and preservation of the six numbered voice secret references.

Cloud Run revision used for the successful synthetic voice acceptance:

`claimflow-api-00018-7c5`

Stable production URL:

`https://claimflow-api-vb6ijwpumq-ts.a.run.app`

The production run successfully demonstrated:

`incident.date contradiction → safe clarification draft → human approval → ElevenLabs/Twilio call → participant confirmation → signed transcript → human canonical correction → RESOLVED`

See [ElevenLabs production E2E acceptance](elevenlabs-live-acceptance.md).

## Final pre-recording check

Run one fresh synthetic case and confirm:

1. the application loads from the production URL;
2. runtime mode shows Gemini/Vertex rather than mock mode;
3. the five-page synthetic packet uploads successfully;
4. all six workflow stages complete;
5. extracted fields show page-linked evidence;
6. `incident.date` displays `2026-09-10` versus `2026-09-11` as an active conflict;
7. `damage.estimatedAmount` displays `AUD 4,860.00` versus `AUD 4,142.00` as an active conflict;
8. simple **Accept value** is disabled for an active conflict;
9. **Voice clarification · ElevenLabs** is visible;
10. reviewer key can be entered privately without being recorded or published;
11. creating a clarification always produces an editable draft, even if optional Gemini wording falls back;
12. the exact question must be human-approved before **Start ElevenLabs call** appears;
13. the call reaches only the configured synthetic participant;
14. the ElevenLabs agent asks the approved question, confirms the answer, and ends the call;
15. **Refresh call status** reveals the returned transcript;
16. the field remains unchanged until a human canonical correction is saved;
17. after correction, the field shows the canonical value and **Resolved by human** rather than an active conflict badge;
18. original page evidence and clarification transcript evidence remain linked;
19. the clarification shows `RESOLVED`;
20. the audit timeline records the voice lifecycle and human correction;
21. no UI text claims that ClaimFlow automatically approves or denies claims.

If these checks pass, stop changing the product before recording.

## Recommended 2–3 minute video script

### 0:00–0:20 — Problem

“Claims, restoration, and field-service teams receive important facts across messy PDFs, photos, handwritten forms, and emails. OCR can copy text, but teams still have to reconcile uncertainty and contradictions manually.”

### 0:20–0:40 — Product

“ClaimFlow turns those documents into an evidence-linked case. Gemini on Vertex AI works inside a controlled ADK workflow, while deterministic TypeScript rules decide what needs human review.”

### 0:40–1:00 — Live processing

Create a fresh synthetic case, upload the five-page packet, and start extraction. Briefly show the six agent stages.

### 1:00–1:25 — Evidence + contradiction

Show the `incident.date` conflict with page 1 and page 4 evidence.

“ClaimFlow does not silently pick one answer. It preserves both source values and requires a human-supported resolution.”

### 1:25–2:05 — ElevenLabs clarification

Open **Voice clarification · ElevenLabs**.

- create the clarification;
- show the editable question;
- explain that optional Gemini wording can safely fall back to a deterministic template;
- approve the exact question;
- start the call explicitly;
- show a very short cut of the real ElevenLabs/Twilio call;
- answer `2026-09-11`.

“The reviewer controls the wording and the external action. The UI cannot dial arbitrary numbers.”

### 2:05–2:35 — Transcript does not auto-decide

Refresh the call status and show the transcript.

“The transcript is evidence, not authority. ClaimFlow still refuses to change the field automatically.”

Enter `2026-09-11`, provide the review reason, and save the human correction.

### 2:35–3:00 — Resolution + close

Show:

- `Resolved by human`;
- retained page evidence;
- clarification transcript evidence;
- `incident.date · RESOLVED`;
- audit timeline.

“Agents extract, plan, and communicate, but deterministic code and people control consequential changes. ClaimFlow prepares the case; it does not approve or deny the claim.”

## Submission description draft

### One-line description

ClaimFlow AI is an evidence-first agentic workflow that turns messy claims paperwork into structured, source-linked cases, detects contradictions, and lets a human approve an ElevenLabs clarification call before saving the final canonical value.

### Problem

Claims, restoration, insurance, and field-service teams receive important information through inconsistent PDFs, photos, forms, notes, and emails. Staff must manually transcribe and reconcile facts, which is slow and makes contradictions easy to miss.

### Solution

ClaimFlow ingests synthetic documents, stores originals privately, uses Gemini on Vertex AI for multimodal extraction, validates structured output with Zod, coordinates processing through Google ADK, applies deterministic business rules, and presents uncertain values with their source evidence in a human-review workspace.

When the supplied documents disagree, ClaimFlow can prepare a clarification question, require a reviewer to approve the exact wording, place a real ElevenLabs/Twilio call to a configured synthetic participant, receive a signed post-call transcript as evidence, and still require a human to save the final canonical value before the case changes.

### What is agentic

The backend runs a controlled six-stage workflow:

1. Intake
2. Quality
3. Extraction
4. Validation
5. Case planning
6. Review routing

Gemini also optionally improves clarification wording. ElevenLabs handles the approved voice interaction. Agents interpret and communicate, while ordinary services handle persistence, schemas, deterministic checks, authorization gates, and consequential state transitions.

### Google Cloud / AI technologies

- Gemini 3.5 Flash on Vertex AI
- Google Agent Development Kit (ADK)
- Cloud Run
- Firestore
- Cloud Storage
- Secret Manager
- Cloud Logging
- GitHub Actions with Google Workload Identity Federation / OIDC

### ElevenLabs integration

- ElevenLabs Agents
- Twilio outbound telephony integration
- dynamic variables for exact approved question/context
- native **End conversation** tool
- HMAC-signed post-call transcript webhook
- human-only canonical correction after transcript return

### Responsible-use boundary

ClaimFlow is a hackathon prototype for case preparation, not an autonomous insurance decision system. It uses synthetic/redacted inputs and does not approve or deny claims, determine liability, or run autonomous customer-contact campaigns.

The demo voice path is restricted to one preconfigured consenting test participant. The reviewer key is a demo operator capability, not production user authentication.

## Suggested technology tags

Use only tags supported by the hackathon form, prioritizing:

- Agentic AI
- ElevenLabs
- Voice AI
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

Capture at least these five frames:

1. **Workflow overview** — six stages complete and extracted fields visible.
2. **Active date contradiction** — `incident.date`, both source pages, `Conflict detected`.
3. **Approved voice clarification** — candidate values and exact approved question; do not show the reviewer key.
4. **Returned transcript** — clarification evidence and participant confirmation.
5. **Resolved field + audit** — `2026-09-11`, `Resolved by human`, retained source + transcript evidence, and audit timeline.

Optional sixth frame: architecture diagram or green GitHub Actions deployment evidence.

## Judge question preparation

### Why is this better than OCR?

OCR returns text. ClaimFlow creates a typed case, preserves evidence lineage, checks deterministic rules, surfaces contradictions, routes uncertainty, can collect an approved clarification when evidence is insufficient, and records the final human decision.

### Why use agents instead of one large prompt?

The staged workflow makes responsibilities and failures visible. Quality, extraction, validation, planning, review routing, and voice clarification have explicit boundaries, while deterministic code retains authority over business rules and state transitions.

### What happens when Gemini is wrong or unavailable?

Model output is untrusted. Extraction is schema/rule validated. For voice clarification, Gemini wording is optional: timeout/provider/invalid-output conditions preserve a safe deterministic draft. No call occurs until the reviewer approves the exact question.

### What does ElevenLabs add?

It closes the gap between “we found a contradiction” and “we obtained a clarification.” The integration is not decorative TTS: ClaimFlow creates a protected request, requires human approval, places a real call, receives a signed transcript, attaches it as evidence, and still requires a human to decide the canonical value.

### Why does the transcript not update the field automatically?

Speech recognition and caller statements are still evidence, not verified authority. The human reviewer must inspect the transcript, enter the canonical value, provide a reason, and trigger deterministic revalidation.

### How do you prevent accidental or arbitrary calls?

The call requires the reviewer key, an approved clarification state, and a separate explicit call action. The destination is fixed server-side; the browser cannot provide an arbitrary number. Ambiguous provider failures are not automatically retried.

### Why not use Document AI?

The five-page live benchmark was successfully processed by Gemini multimodal extraction with page-linked evidence and deliberate conflicts preserved. Document AI was evaluated and deferred until harder handwriting, blurry-scan, or layout benchmarks show a measurable improvement worth the extra service complexity.

### How would this become production-ready?

Add authenticated reviewer identity and granular authorization, broader evaluation datasets, malware/file scanning, production queues/outbox and reconciliation, monitoring/SLOs, formal privacy/compliance controls, consent/retention policies, and domain-specific case-management integrations.

## Private judge access note

If judges need to trigger a live voice call, provide the reviewer key **privately** through the hackathon's secure/private channel.

Never put the key in:

- README;
- source code;
- GitHub issues;
- submission description;
- YouTube/Vimeo description;
- public screenshots or video overlays.

After judging, rotate the reviewer token if it was shared.

## Final submission checklist

- [x] Core application implemented
- [x] Gemini live extraction verified
- [x] ADK workflow verified
- [x] Evidence-linked fields verified
- [x] Same-document date/amount conflicts verified live
- [x] Human-review correction flow verified
- [x] ElevenLabs/Twilio provider-level call verified
- [x] ClaimFlow → ElevenLabs real outbound call verified
- [x] Signed transcript webhook verified live
- [x] Human-only canonical correction after transcript verified
- [x] Clarification reaches `RESOLVED` after deterministic validation
- [x] Safe drafting fallback verified live after prior 502 regression
- [x] Firestore and Cloud Storage persistence implemented
- [x] Keyless CI/CD and voice-secret reference preservation verified
- [x] Document AI decision documented
- [x] Phase 11 evaluation evidence documented
- [x] README and architecture updated for voice acceptance
- [ ] Merge final submission-cleanup PR and confirm CI/deploy
- [ ] Run one fresh production case after final deploy
- [ ] Record final 2–3 minute video
- [ ] Save final screenshots
- [ ] Paste and proofread hackathon submission text
- [ ] Link production URL and GitHub repository
- [ ] Provide reviewer key privately only if interactive judging requires it
- [ ] Capture final submission confirmation

## Stop condition

After the final submission-cleanup PR passes CI, deploys successfully, and one fresh case reproduces the expected conflict → call → transcript → human resolution path, freeze the application until submission unless a blocking defect is discovered.
