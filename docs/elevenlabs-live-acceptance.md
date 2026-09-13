# ElevenLabs production E2E acceptance

Status: **PASS — live synthetic acceptance completed**

Date: 2026-09-14 (Australia)

## Purpose

This document records the production acceptance evidence for ClaimFlow's human-approved ElevenLabs voice clarification loop. It is intentionally limited to a synthetic case and a configured consenting test participant.

The acceptance target was not merely "a phone call happened." The required proof was the complete controlled workflow:

`document contradiction → reviewer-approved question → outbound call → signed transcript → human canonical correction → deterministic revalidation → resolved clarification`

## Production baseline

The live acceptance run used the production deployment created from merge commit:

`adf9664a0b3b11c9948cb6ffa3236ec1c83598a9`

GitHub Actions CI run `#66` passed:

- formatting, lint, typecheck, tests and build;
- Firestore integration tests;
- packaged container smoke test;
- GitHub OIDC / Workload Identity Federation authentication;
- Cloud Run deployment;
- public `/health` and `/ready` verification;
- stable application URL verification;
- preservation of all six numbered voice secret references.

Cloud Run revision used for the acceptance call:

`claimflow-api-00018-7c5`

Stable application URL:

`https://claimflow-api-vb6ijwpumq-ts.a.run.app`

No secret values, reviewer key, Twilio credentials, or participant phone number are recorded in this evidence file.

## Synthetic case

The official five-page synthetic motor-claim packet contained the deliberate date contradiction:

- source page 1: `10 September 2026`;
- source page 4: `11 September 2026`;
- normalized candidates: `2026-09-10` and `2026-09-11`.

ClaimFlow preserved both values and created a `CONTRADICTION` issue. Simple acceptance of the combined model value was not permitted.

## Acceptance sequence and result

| Step | Expected behavior | Result |
| --- | --- | --- |
| 1 | Reviewer enters protected voice reviewer key | PASS |
| 2 | Reviewer requests clarification for `incident.date` | PASS |
| 3 | Draft creation must not fail the workflow if optional Gemini wording is unavailable | PASS |
| 4 | Safe template remains editable and human approval is required | PASS |
| 5 | Reviewer explicitly approves the exact question | PASS |
| 6 | Reviewer separately starts the call | PASS |
| 7 | Outbound call reaches only the configured test participant | PASS |
| 8 | ElevenLabs agent identifies the synthetic AI call and asks the approved date question | PASS |
| 9 | Participant answers `2026-09-11` | PASS |
| 10 | Agent repeats the answer for confirmation and ends the call | PASS |
| 11 | Signed post-call transcript returns to ClaimFlow | PASS |
| 12 | Conversation/call identifiers and received timestamp are persisted | PASS |
| 13 | Transcript appears as clarification evidence | PASS |
| 14 | Field remains unresolved until human correction | PASS |
| 15 | Reviewer enters canonical value `2026-09-11` and a reason | PASS |
| 16 | Deterministic validation reruns | PASS |
| 17 | Clarification reaches `RESOLVED` | PASS |
| 18 | Original document evidence remains attached beside clarification evidence | PASS |

## Drafting resilience verified live

The production acceptance run exercised the fallback path introduced after the earlier clarification-drafting `502` regression.

The UI reported that optional AI wording was unavailable and used the safe deterministic template instead. The workflow continued to an editable `DRAFT`; no call was made until the reviewer approved the exact wording and then explicitly started the call.

This proves that Gemini wording is an assistive enhancement rather than a single point of failure.

The historical root cause of the earlier generic `502` cannot be claimed with certainty because the old catch block discarded the provider exception. A 15-second drafting timeout was a strong candidate, but the corrected design now handles timeout, provider failure, incomplete output, invalid text, and candidate loss through bounded diagnostics plus safe fallback.

## Human-control property verified live

After the transcript returned, ClaimFlow did **not** automatically write `2026-09-11` into the case.

The reviewer still had to enter:

- final canonical value: `2026-09-11`;
- an explicit correction reason.

Only after that action did deterministic validation rerun and the clarification become `RESOLVED`.

This is a core safety property: a voice transcript is evidence, not authority.

## Evidence lineage

After resolution, the corrected date retained:

- the original page-1 source evidence;
- the original page-4 contradictory source evidence;
- a clarification-transcript evidence reference containing the participant answer.

Submission UI cleanup distinguishes an **active conflict** from a **historical conflict resolved by human review** while preserving all original evidence and audit history.

## Security and operational controls exercised

The acceptance run retained these controls:

- reviewer-key protection for draft/approve/call/correction operations;
- fixed server-side test destination; the browser cannot provide an arbitrary number;
- explicit approval before external contact;
- separate explicit call action after approval;
- no automatic redial after ambiguous provider failure;
- raw-body HMAC verification for ElevenLabs webhooks;
- provider conversation ID used for case lookup rather than caller-supplied case context;
- no audio persisted by ClaimFlow;
- transcript size bounds and truncation disclosure;
- no automatic claim approval/denial;
- no automatic transcript-to-field mutation.

## Submission claim

ClaimFlow can accurately claim that its ElevenLabs integration is **production-deployed and live-verified with a real synthetic outbound clarification call**.

The supported submission statement is:

> When supplied documents conflict, ClaimFlow can prepare a clarification question, require a human to approve it, place a real ElevenLabs/Twilio call to a configured synthetic participant, receive a signed transcript as evidence, and still require a human to save the final canonical value before the case changes.

Do not claim general production readiness, customer-contact automation, insurance decision authority, or accuracy beyond the tested synthetic scenarios.
