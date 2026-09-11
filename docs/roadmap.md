# Hackathon Roadmap

## Phase 0 — Planning before the official start

- agree on scope, demo case, and ownership;
- create architecture and safety documentation;
- prepare issue backlog;
- confirm Google Cloud billing limits and allowed services;
- confirm team registration and current-student requirement;
- do not add executable product code.

## Phase 1 — Foundation (hours 0–6)

- bootstrap TypeScript workspace;
- define case, document, field, evidence, issue, and audit schemas;
- create synthetic sample-data policy and fixtures;
- establish unit tests and CI;
- create minimal React and API shells.

**Exit:** typed case can be created and rendered without AI.

## Phase 2 — Vertical slice (hours 6–18)

- upload one synthetic document;
- run Gemini multimodal extraction;
- validate typed output;
- persist a case;
- display fields, confidence, and evidence;
- deploy the first Cloud Run version.

**Exit:** one document completes an end-to-end deployed flow.

## Phase 3 — Agentic workflow (hours 18–30)

- add quality assessment;
- process multiple documents;
- add deterministic rules;
- detect one missing field and one contradiction;
- implement review routing and audit events.

**Exit:** the demo case reaches `NEEDS_REVIEW` for the correct reasons.

## Phase 4 — Human review and outcome (hours 30–38)

- build accept/edit/reject controls;
- invalidate stale derived output after correction;
- generate summary and next actions;
- add tests for error and low-confidence paths.

**Exit:** corrected case reaches `READY` with traceable history.

## Phase 5 — Polish and optional voice (hours 38–43)

- improve responsive UI and loading/error states;
- add ElevenLabs communication preview only if the core is stable;
- measure latency, extraction result, and correction effort.

## Phase 6 — Submission (hours 43–48)

- freeze scope;
- run smoke tests on production;
- verify public repository and README;
- record 3–5 minute functional walkthrough;
- complete Devpost;
- rehearse the final pitch and Q&A.

## Cut order under time pressure

1. real outbound communication;
2. Document AI comparison;
3. asynchronous queue;
4. authentication polish;
5. dashboards and analytics.

Never cut evidence display, contradiction handling, human review, deployment, or the end-to-end demo.
