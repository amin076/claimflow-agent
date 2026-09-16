# Engineering Quality, Testing and Failure Auditing

ClaimFlow is designed so that failures can be isolated to a specific engineering boundary instead of being described generically as an AI failure.

## Quality strategy

The repository uses several complementary layers of verification:

1. **Static gates** - formatting, linting and TypeScript type checking.
2. **Unit tests** - domain rules, schema validation, error classification and provider adapters.
3. **Workflow tests** - the full six-stage ADK processing path, including success and failure branches.
4. **Integration tests** - Firestore emulator and persistence behavior.
5. **Container smoke tests** - the packaged service is started and probed as the deployable artifact.
6. **Production readiness checks** - `/health`, `/ready` and web-root verification after deployment.
7. **Live acceptance tests** - selected end-to-end paths are exercised against real configured providers when appropriate.

## What is tested

The automated suite covers more than the happy path. Representative cases include:

- invalid or truncated model JSON;
- schema-invalid model output;
- foreign/incorrect evidence references;
- forbidden extra fields;
- token-limit and safety-stopped completions;
- concurrent processing protection;
- provider timeouts and aborts;
- stale execution recovery;
- late-result rejection;
- page-budget enforcement;
- unreadable document routing;
- invalid and future dates;
- cross-document contradictions;
- human correction with evidence/reason;
- reviewer authorization;
- outbound clarification reservation and duplicate-call protection;
- signed webhook verification;
- webhook replay idempotency;
- transcript size bounds;
- rejection not silently becoming ready/approved.

## How I find which part of the application failed

I audit failures from the outside in and stop at the first broken boundary.

```text
Browser/UI
  -> API route
  -> storage / persistence
  -> ADK workflow stage
  -> model provider
  -> structured-output schema
  -> deterministic validation rules
  -> human-review state transition
  -> external clarification provider
  -> signed webhook
  -> final persistence / audit event
```

### 1. Request and transport

- confirm HTTP method/path/status;
- record request/case identifiers;
- check timeout or authentication errors;
- reproduce with the smallest equivalent request.

### 2. Persisted workflow state

- inspect the case status;
- inspect the latest `AgentRun` stage and timestamps;
- compare expected vs persisted transition;
- identify whether the job failed before or after an external call.

### 3. Provider/model boundary

- classify the provider error separately from application errors;
- check completion reason, timeout, safety stop or malformed output;
- preserve a safe summary rather than silently retrying unknown failures.

### 4. Schema boundary

- validate model output with Zod;
- reject unexpected/extra fields where the contract forbids them;
- verify evidence references belong to the current case/document set.

### 5. Deterministic business rules

- rerun validation independently of the model;
- inspect date, required-field, confidence and contradiction issues;
- keep rule failures explainable and reproducible.

### 6. Human-review boundary

- verify that only authorised reviewer actions can change canonical state;
- confirm AI suggestions/transcripts remain evidence until explicitly accepted;
- preserve the reason for manual corrections.

### 7. External clarification/webhook boundary

- verify signed payloads;
- enforce idempotency/replay protection;
- correlate external conversation IDs to the correct case;
- never auto-redial on ambiguous provider timeouts.

## Regression rule

A bug fix is not complete when the code merely appears to work again. The failure should be converted into the smallest practical regression test so the same defect cannot silently return.

Typical sequence:

```text
Observe failure
-> isolate boundary
-> reproduce deterministically
-> add regression test
-> implement smallest safe fix
-> run targeted tests
-> run full quality gates
-> build container
-> deploy
-> post-deploy smoke/readiness check
```

## Commands

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

The GitHub Actions pipeline extends these with emulator, container and deployment checks.

## Observability principles

For production-oriented agent systems, useful telemetry includes:

- case ID / run ID;
- workflow stage;
- model and prompt version;
- provider duration and token usage;
- safe provider error category;
- input/output evidence references;
- validation issues;
- human approvals/corrections;
- audit events and final state transitions.

This makes model behavior reviewable as part of a normal software system rather than an opaque conversational process.
