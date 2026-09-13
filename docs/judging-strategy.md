# Judging Strategy

## Preliminary score alignment

| Criterion | Evidence to show |
|---|---|
| Functionality | One stable deployed flow from document ingestion through conflict detection, real voice clarification, transcript return, and human resolution |
| Technical difficulty | ADK orchestration, multimodal extraction, typed contracts, deterministic conflict routing, ElevenLabs/Twilio outbound call, signed webhook verification |
| Code quality | Modular boundaries, Zod schemas, explicit state machines, Firestore transactions, tests, safe provider fallbacks |
| Data/models | Model-choice rationale, bounded calls, synthetic benchmark, page-linked evidence, measured live behavior |
| Originality | Evidence lineage plus human-approved voice clarification instead of autonomous decisioning |
| Differentiation | Contrast with plain OCR, generic chat wrappers, and voice demos that are not connected to case state/evidence |
| Problem significance | Document-heavy case coordination with real contradictions and missing information |
| Feasibility | Clear production gaps, approval boundaries, private secret handling, adoption path |
| Impact | Explain reduced manual reconciliation steps; quantify only after a measured benchmark |

## Demo priorities

1. Reliability before feature count.
2. Show source evidence beside the active contradiction.
3. Demonstrate that the system refuses to silently pick a conflicting value.
4. Make the ElevenLabs integration visibly consequential: approved question → real call → signed transcript → human correction.
5. Explicitly show that the transcript does **not** auto-update the case.
6. End on `Resolved by human` plus retained evidence/audit trail.
7. Quantify only what the team has measured.
8. Name limitations before judges discover them.
9. Never expose the reviewer key, phone number, API key, webhook secret, or Twilio credentials in the recording.

## Finals pitch arc

**Messy evidence → contradiction → controlled agent workflow → human-approved voice clarification → transcript as evidence → human resolution → auditable case.**

The key message is not “AI makes the insurance decision.” It is the opposite: ClaimFlow uses AI to reduce reconciliation work while preserving human authority over consequential changes.

## Strongest live proof

The production `incident.date` acceptance run demonstrated:

- source page 1 says `2026-09-10`;
- source page 4 says `2026-09-11`;
- ClaimFlow creates a contradiction instead of choosing;
- safe clarification drafting survives optional Gemini wording failure;
- reviewer approves the exact question;
- ElevenLabs/Twilio places a real call to the configured synthetic participant;
- participant confirms `2026-09-11`;
- signed transcript returns to ClaimFlow;
- field remains unresolved until human correction;
- human saves `2026-09-11` with a reason;
- clarification reaches `RESOLVED` and evidence lineage is retained.

## Likely judge questions

### Why is this agentic rather than a single prompt?

The six-stage workflow separates intake, quality, extraction, validation, planning, and review routing. Voice clarification has its own explicit lifecycle. Model output is never the final authority over persistence or consequential state transitions.

### What happens when Gemini drafting fails?

Clarification wording gracefully falls back to a deterministic editable template. The reviewer still must approve the exact question before a call. The live acceptance run exercised this path successfully.

### What does ElevenLabs add to the core workflow?

It closes the operational loop after the system identifies an unresolved contradiction. The voice agent is not decorative TTS: it asks the exact human-approved question, returns a signed transcript as evidence, and then stops. It cannot mutate the claim.

### Why not automatically trust the caller answer?

Voice transcription can be wrong and a caller statement may still require judgment. ClaimFlow therefore treats the transcript as evidence. A human enters the canonical value and reason, and deterministic validation reruns.

### How do you prevent arbitrary or accidental calls?

Voice operations require the private reviewer capability key, an approved clarification state, and a separate explicit call action. The destination is fixed server-side. Concurrent call attempts are reserved atomically and ambiguous failures are not automatically redialed.

### How do you prevent prompt injection from documents or dynamic variables?

Documents/context are treated as data, not instructions. Tool permissions, recipients, approval requirements, and allowed actions are code-level policy. The ElevenLabs agent has no ClaimFlow mutation tool.

### Why use both Gemini and deterministic rules?

Gemini handles interpretation of messy multimodal inputs and optional natural-language wording. Deterministic TypeScript code owns formats, contradictions, state transitions, evidence requirements, and the conditions for resolution.

### What data would a real deployment require?

A representative, consented, privacy-governed dataset across document types, handwriting quality, layouts, languages, failure modes, and business rules. The current claims are limited to synthetic benchmark evidence.

### How would you measure accuracy and ROI?

Measure field-level extraction accuracy, evidence-link correctness, contradiction recall, clarification completion rate, human correction time, total handling time, and cost per case against the existing manual workflow.

### What are the current production gaps?

The MVP still needs production identity/authorization, customer-consent and retention policy, broader evaluation, malware/file scanning, durable queues/outbox/reconciliation, monitoring/SLOs, and domain-specific system integrations.

## Judge access

If interactive judging requires the reviewer key, send it privately through an approved private channel. Rotate it after judging. Do not publish it in repository files, submission text, screenshots, or video descriptions.
