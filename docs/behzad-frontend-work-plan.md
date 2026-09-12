# Behzad's Frontend Onboarding and Work Plan

This is the working guide for Behzad's ClaimFlow AI Frontend contribution. Complete the environment check before changing code, then follow the ordered Frontend tasks below.

For detailed setup and troubleshooting, use the [Local Development Guide](local-development.md) or the [Farsi Local Development Guide](local-development.fa.md).

## 1. Your responsibility

You own the user-facing workflow for:

- the case list and case workspace;
- creating a case and selecting a synthetic document;
- processing, empty, loading, success, and error states;
- extracted fields, confidence, and source evidence;
- validation warnings and missing information;
- the human-review queue and review controls;
- the case audit timeline;
- responsive behavior and usability.

Amin owns the Backend, domain/API integration, Google Cloud foundation, Firestore, Cloud Run, Gemini, ADK, and Phase 3 integration work. Coordinate any shared contract change before implementing it.

## 2. Rules before you begin

- Use synthetic test data only. Never use real customer or claim documents.
- Never commit `.env`, credentials, service-account JSON, tokens, or API keys.
- Do not copy another developer's Google credentials.
- Local Frontend work does not require a Google account or `gcloud`.
- Do not modify `apps/api`, `infrastructure`, or Cloud configuration as part of a Frontend Pull Request.
- Do not change a schema in `packages/domain` without agreeing on the API contract first.
- Do not push feature work directly to `main`.
- Keep each Pull Request small enough for another team member to review safely.

## 3. First-time setup

### Install the required tools

Install current stable Git, Node.js 22.x, and npm 11.9.0. TypeScript 6.0.3 is installed locally with the repository dependencies; do not install TypeScript globally.

Check the versions in PowerShell:

```powershell
git --version
node --version
npm --version
```

If npm is not 11.9.0:

```powershell
npm install --global npm@11.9.0
```

Close and reopen PowerShell after installing or updating Node.js/npm.

### Clone and prepare the repository

Open PowerShell in any parent folder you choose for development, then run:

```powershell
git clone https://github.com/amin076/claimflow-agent.git
Set-Location claimflow-agent
git switch main
git pull origin main
npm ci
Copy-Item .env.example .env
```

If the repository is already cloned, do not clone it again. Open PowerShell in the existing repository and run:

```powershell
git switch main
git pull origin main
npm ci
```

## 4. Prove the application works before editing it

From the repository root, start both applications:

```powershell
npm run dev
```

| Service | Address |
|---|---|
| React Frontend | `http://localhost:5173` |
| Fastify Backend | `http://localhost:8080` |
| Backend health | `http://localhost:8080/health` |
| Current demo API | `http://localhost:8080/api/cases/demo` |

If combined logs are unclear, open two PowerShell windows in the repository root.

Terminal 1 — Backend:

```powershell
npm run dev:api
```

Terminal 2 — Frontend:

```powershell
npm run dev:web
```

Verify the Backend from another PowerShell window:

```powershell
Invoke-RestMethod http://localhost:8080/health
Invoke-RestMethod http://localhost:8080/api/cases/demo
```

The environment check passes only when:

- `/health` returns `status: ok` and `service: claimflow-api`;
- `/api/cases/demo` returns case reference `CF-2026-001`;
- `http://localhost:5173` opens in the browser;
- selecting **Create demo case** renders extracted fields, confidence bars, evidence, and two open issues;
- the browser console has no unexpected errors.

If the page reports `API returned 502`, the Frontend cannot reach the Backend. Start `npm run dev:api`, verify `/health`, and reload the browser.

Do not begin implementation until this checklist passes. If it does not pass, send the exact command, terminal output, browser error, Node.js version, and npm version to the team.

## 5. Understand the current Frontend

The current Phase 2 interface is intentionally small:

- `apps/web/src/App.tsx` contains the current page and API request;
- `apps/web/src/main.tsx` starts React and defines the Material UI theme;
- `apps/web/vite.config.ts` proxies `/api` calls to the local Backend;
- `packages/domain/src` contains shared Zod schemas and TypeScript types;
- `GET /api/cases/demo` is the only case endpoint the Frontend can use today.

The browser validates the demo response with `ClaimCaseSchema`. Keep that runtime validation when reorganizing the UI.

## 6. Your first assignment: Frontend foundation

Create a branch from the latest `main`:

```powershell
git switch main
git pull origin main
git switch -c feature/frontend-case-workspace
```

Your first Pull Request should reorganize the existing Phase 2 screen into a clean Frontend foundation without changing its behavior.

Create this structure under `apps/web/src`:

```text
apps/web/src/
├── components/
│   ├── AppShell.tsx
│   ├── CaseSummary.tsx
│   ├── ExtractedFieldList.tsx
│   ├── IssueList.tsx
│   └── StatusChip.tsx
├── pages/
│   └── DemoCasePage.tsx
├── services/
│   └── caseApi.ts
├── App.tsx
└── main.tsx
```

Responsibilities:

- `caseApi.ts`: fetch `/api/cases/demo`, check the HTTP result, and validate JSON with `ClaimCaseSchema`;
- `DemoCasePage.tsx`: own loading, error, and loaded-page state;
- `CaseSummary.tsx`: show the reference, title, and status;
- `ExtractedFieldList.tsx`: show field name, value, confidence, evidence, and review indication;
- `IssueList.tsx`: show warnings and blocking issues with appropriate severity;
- `StatusChip.tsx`: consistently map domain status values to readable labels and colors;
- `AppShell.tsx`: provide the shared page width, spacing, heading, and responsive layout;
- `App.tsx`: remain a small composition/root component.

### Acceptance criteria for the first Pull Request

- The existing **Create demo case** journey still works against the real local Fastify endpoint.
- API response validation remains in place.
- Loading, error, and success states remain visible and accessible.
- Confidence, evidence, and both open issues remain visible.
- The layout works at desktop width and approximately 390 px mobile width.
- There are no hard-coded local computer paths or credentials.
- No Backend, infrastructure, or Cloud files are changed.
- Formatting, linting, type checking, tests, and build all pass.
- Include desktop and mobile screenshots in the Pull Request description.

Do not add routing, a new state-management library, or an API library in this first PR. React state and the browser `fetch` API are sufficient for the current scope.

## 7. Ordered Frontend work after the first PR

Do these as separate Pull Requests. Begin each item only after its API contract or mock fixture is confirmed with Amin.

### Frontend PR 2 — Case list

Build a responsive case-list screen with the reference, title, status, updated time, issue/review indication, loading/empty/error/populated states, and a clear new-case action. Do not invent the final `GET /api/cases` response; use an agreed typed fixture until the Backend endpoint is ready.

### Frontend PR 3 — New case and synthetic upload

Build the new-case flow with a synthetic-data warning, agreed inputs, drag-and-drop and file-picker presentation, file guidance, selected-file removal, validation, processing states, and keyboard-accessible controls. Never upload real personal or insurance documents during development.

### Frontend PR 4 — Case workspace

Build the full extracted-case view with the case header, processing status, grouped fields, confidence, evidence beside each important value, and clear visual distinction for missing, conflicting, and low-confidence values.

### Frontend PR 5 — Human-review queue and controls

Build queue filters based on agreed statuses, issue reason/severity, original value/evidence, correction input, accept/correct/escalate actions, confirmation, and API error states. ClaimFlow AI assists case preparation; it must never present an autonomous insurance-claim approval or denial.

### Frontend PR 6 — Audit timeline and final polish

Show event time, actor type, action, affected field/case, and outcome. Complete responsive checks, keyboard navigation, visible focus, accessible labels, useful empty/error messages, and demo-path polish.

## 8. Coordination boundary with Backend and Cloud work

Frontend work can proceed locally while Cloud foundations are being built.

| Behzad may do independently | Confirm with Amin first |
|---|---|
| Component structure and responsive layout | New endpoint paths or response shapes |
| Loading, empty, error, and display states | Changes to `packages/domain` schemas |
| Accessibility and visual hierarchy | New npm dependencies |
| Typed fixtures based on agreed schemas | Authentication or IAM behavior |
| Frontend tests and screenshots | Firestore, Cloud Storage, Cloud Run, Gemini, or ADK changes |

When a real endpoint is not ready, build against a typed fixture and keep data access inside `services/`. This lets the team replace the fixture with the real API without rewriting presentation components.

## 9. Validate every change

From the repository root:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Also start both applications, complete the changed workflow, check desktop and mobile widths, inspect the browser console and terminal logs, and confirm the existing demo still works.

## 10. Commit, push, and open a Pull Request

Review changes before committing:

```powershell
git status
git diff
```

For the first assignment:

```powershell
git add apps/web
git commit -m "feat(web): add case workspace foundation"
git push -u origin feature/frontend-case-workspace
```

Open a Pull Request into `main`. Include what changed, what did not change, test results, desktop/mobile screenshots, API assumptions, and known limitations. Do not merge before CI passes and the other team member reviews it.

## 11. Definition of done for the Frontend stream

The Frontend stream is complete when a user can:

1. view cases;
2. start a synthetic case;
3. see processing state;
4. inspect extracted values, confidence, and evidence;
5. understand missing or conflicting information;
6. review, correct, or escalate uncertain output;
7. see the audit history;
8. complete the demo on desktop and mobile without console errors.

Keep presentation components independent of storage and Cloud details, and integrate only through agreed typed API contracts.
