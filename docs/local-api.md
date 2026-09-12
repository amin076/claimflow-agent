# Phase 3 Local API Contract

This contract supports the deterministic local workflow. It uses an in-memory repository and synthetic metadata; restarting the API clears cases created during that run. Google Cloud credentials are not required.

Base URL: `http://localhost:8080`

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Verify the API is running |
| `GET` | `/api/cases/demo` | Return the fixed Phase 2 demonstration case |
| `POST` | `/api/cases` | Create a draft case |
| `GET` | `/api/cases` | List current in-memory cases |
| `GET` | `/api/cases/:id` | Get a case by ID |
| `POST` | `/api/cases/:id/documents` | Attach synthetic document metadata |
| `POST` | `/api/cases/:id/process` | Run deterministic mock extraction and validation |
| `PATCH` | `/api/cases/:id/review` | Record a human-review action |
| `GET` | `/api/cases/:id/audit-events` | Get the case audit timeline |

All successful case endpoints return data conforming to the shared schemas in `packages/domain`. Invalid request bodies return HTTP `400`, unknown cases return `404`, and processing without a document returns `409`.

## Complete PowerShell smoke test

Start the applications with `npm run dev`, then use another PowerShell window.

### Create a case

```powershell
$claim = Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:8080/api/cases `
  -ContentType "application/json" `
  -Body '{"title":"Synthetic water-damage case"}'

$claim | Select-Object id, reference, title, status
```

Save the returned ID automatically:

```powershell
$caseId = $claim.id
```

### Add synthetic document metadata

This endpoint does not upload file bytes yet.

```powershell
$claim = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8080/api/cases/$caseId/documents" `
  -ContentType "application/json" `
  -Body '{"filename":"synthetic-claim-form.jpg","mimeType":"image/jpeg","type":"CLAIM_FORM"}'
```

### Process the case

```powershell
$claim = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8080/api/cases/$caseId/process"

$claim | Select-Object id, reference, status
$claim.fields | Select-Object name, displayValue, confidence, requiresReview
$claim.issues | Select-Object type, severity, status, message
```

The deterministic mock produces three evidence-linked fields and two issues. It does not call Gemini or make an insurance decision.

### Correct the uncertain date

```powershell
$reviewBody = @{
  reviewerId    = "local-reviewer"
  action        = "CORRECT"
  fieldName     = "incident.date"
  correctedValue = "2026-09-06"
  reason        = "Confirmed against the clearer synthetic source."
} | ConvertTo-Json

$claim = Invoke-RestMethod `
  -Method Patch `
  -Uri "http://localhost:8080/api/cases/$caseId/review" `
  -ContentType "application/json" `
  -Body $reviewBody
```

Supported review actions are `ACCEPT`, `CORRECT`, `REJECT`, `ESCALATE`, and `REQUEST_INPUT`. `ACCEPT`, `CORRECT`, and `REJECT` require `fieldName`; `CORRECT` also requires `correctedValue`.

### Read the audit timeline

```powershell
Invoke-RestMethod "http://localhost:8080/api/cases/$caseId/audit-events" |
  Select-Object timestamp, actorType, action, outcome, summary
```

### List and retrieve cases

```powershell
Invoke-RestMethod http://localhost:8080/api/cases |
  Select-Object id, reference, title, status

Invoke-RestMethod "http://localhost:8080/api/cases/$caseId"
```

## Frontend integration rule

Keep HTTP access inside `apps/web/src/services`. Validate returned cases with `ClaimCaseSchema`. Do not duplicate domain types in the Frontend or infer new fields that are absent from the shared schema. Coordinate contract changes before modifying the Backend or `packages/domain`.

## Current limitations

- storage is in memory and resets when the API restarts;
- document endpoints accept synthetic metadata, not file bytes;
- processing uses deterministic fixtures rather than Gemini;
- authentication is intentionally deferred;
- Firestore and Cloud Storage adapters are not connected yet;
- review actions assist preparation and never approve or deny a claim.
