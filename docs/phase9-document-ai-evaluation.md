# Phase 9 — Document AI evaluation

**Status: complete — Document AI deferred for the hackathon MVP.**

## Decision

ClaimFlow will keep the production extraction path as:

```text
Document → Gemini multimodal on Vertex AI → Zod validation → deterministic rules → human review
```

Google Document AI is **not** added to the production path before the hackathon deadline.

This is a deliberate evidence-based defer, not an untested assumption. The Phase 9 roadmap exit criterion allows Document AI to be included, deferred, or rejected based on observed extraction quality.

## Evidence used

On 13 September 2026, the live Cloud Run application processed a five-page synthetic motor-claim packet with Gemini 3.5 Flash. The packet intentionally included narrative text, tables, an email, assessor-style notes, repeated facts, and conflicting values across different pages.

Observed live result:

- all six ADK workflow stages completed successfully;
- 11 supported ClaimFlow fields were extracted;
- claimant name, email, phone, incident address, description, registration, make, model, damage description, incident date and estimated damage amount were recovered;
- evidence excerpts were linked to the correct source pages;
- the model preserved the deliberate `2026-09-10` versus `2026-09-11` incident-date conflict;
- the model preserved the deliberate `AUD 4,860` versus `AUD 4,142` estimate conflict;
- the case routed to `NEEDS_REVIEW` rather than making a claim decision;
- the live run reported 9,498 model tokens and about 24.7 seconds end-to-end processing time.

This demonstrates that Gemini-only multimodal extraction is sufficient for the current clean/mixed-layout synthetic demo packet, including tables and multi-page evidence linking.

## Why Document AI is deferred

Adding Document AI now would introduce another production API, IAM surface, processor configuration, integration path and failure mode without current evidence that it materially improves the demo workflow.

The remaining unproven areas are specifically:

- poor photographs and blur;
- difficult handwriting;
- very dense production forms;
- layout-heavy OCR where Gemini evidence recovery becomes unreliable.

Those scenarios should be benchmarked after the core hackathon submission is stable. Document AI should be added only if a controlled comparison shows a material improvement in critical-field recovery or evidence-location accuracy.

## Revisit trigger

Re-open this decision if evaluation shows repeated failures in one or more of these areas:

1. critical fields are legible to a person but consistently missed by Gemini;
2. handwriting or photographed documents cannot be recovered reliably;
3. table/layout structure is repeatedly lost;
4. evidence page/excerpt references become unreliable;
5. a Document AI OCR benchmark materially improves those failures without unacceptable latency or complexity.

## Safety and disclosure

- No real customer data is used for this evaluation.
- Document AI is not part of the current live production workflow.
- Gemini output remains untrusted until schema validation, deterministic checks and human review complete.
- ClaimFlow does not autonomously approve or deny claims.

## Phase 9 exit gate

**PASS.** The team has a documented, evidence-based decision: **defer Document AI for the hackathon MVP; retain Gemini multimodal extraction as the production path and revisit Document AI only when OCR-specific evidence justifies it.**
