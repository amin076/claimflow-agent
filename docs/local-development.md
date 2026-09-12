# Local Development Guide

[نسخه فارسی](local-development.fa.md)

This guide takes a new contributor from an empty machine to a working ClaimFlow AI development environment. The commands in the Windows sections use PowerShell.

## What runs locally

ClaimFlow AI is an npm workspace with two applications:

- `apps/web`: React and Vite Frontend at `http://localhost:5173`
- `apps/api`: Node.js and Fastify Backend at `http://localhost:8080`

Vite proxies browser requests beginning with `/api` to the Backend. The default `.env.example` configuration uses local files, an in-memory database, and mock AI responses. Therefore, normal local development does not require Google Cloud access, `gcloud`, Firebase, Firestore, Gemini, Document AI, a service account, or shared credentials.

## Required software and versions

| Software | Supported team version | How it is used |
|---|---:|---|
| Git | Current stable | Clone, pull, branch, commit, and push |
| Node.js | 22.x or newer | Runs the Backend and development tools; CI uses Node.js 22 |
| npm | 11.9.0 | Installs and runs the workspace; pinned in `package.json` |
| TypeScript | 6.0.3 | Installed inside the repository by npm |

Use Node.js 22 for the closest match to CI. Do not install TypeScript globally: `npm ci` installs the correct project version, and npm scripts use that version automatically. This repository uses npm and `package-lock.json`; do not replace them with Yarn or pnpm files.

Install Git from <https://git-scm.com/download/win> and the Node.js 22 installer from <https://nodejs.org/en/download>. The Node.js installer includes npm; align npm to the pinned version after installation.

Check the installed tools:

```powershell
git --version
node --version
npm --version
```

If npm is not version 11.9.0, update it after installing Node.js:

```powershell
npm install --global npm@11.9.0
```

Close and reopen PowerShell after installing or updating Node.js/npm so the updated programs are available on `PATH`.

## First-time setup on Windows

Choose a normal development directory. The examples use `C:\Physics`.

```powershell
cd C:\Physics
git clone https://github.com/amin076/claimflow-agent.git
cd claimflow-agent
git switch main
git pull origin main
npm ci
Copy-Item .env.example .env
npm run dev
```

Use `npm ci` for a predictable installation from `package-lock.json`. Do not commit `.env`.

When startup succeeds, open `http://localhost:5173`. Select **Create demo case**. The result should show `CF-2026-001`, evidence-linked extracted fields, confidence scores, and two review issues.

Stop the development processes with `Ctrl+C` in the terminal that runs them.

## macOS or Linux setup

The flow is the same; only the copy command differs:

```bash
git clone https://github.com/amin076/claimflow-agent.git
cd claimflow-agent
git switch main
git pull origin main
npm ci
cp .env.example .env
npm run dev
```

## Run both applications

From the repository root:

```powershell
npm run dev
```

This command starts both workspaces and is the normal development command.

| Component | Address |
|---|---|
| Frontend | `http://localhost:5173` |
| Backend | `http://localhost:8080` |
| Health check | `http://localhost:8080/health` |
| Demo case API | `http://localhost:8080/api/cases/demo` |

## Run Frontend and Backend separately

Separate terminals make logs easier to read and let contributors restart one application without stopping the other.

Terminal 1 — Backend:

```powershell
cd C:\Physics\claimflow-agent
npm run dev:api
```

Terminal 2 — Frontend:

```powershell
cd C:\Physics\claimflow-agent
npm run dev:web
```

Terminal 3 — verification:

```powershell
Invoke-RestMethod http://localhost:8080/health
Invoke-RestMethod http://localhost:8080/api/cases/demo
```

The health response should contain `status: ok` and `service: claimflow-api`.

## Environment configuration

The committed `.env.example` is safe to copy. Its development modes are:

```dotenv
STORAGE_MODE=local
DATABASE_MODE=memory
AI_MODE=mock
HOST=0.0.0.0
PORT=8080
WEB_ORIGIN=http://localhost:5173
NODE_ENV=development
```

The Google Cloud project and location variables reserve the intended deployment configuration, but local/mock mode does not authenticate or call those services.

Never commit `.env`, Application Default Credentials, service-account JSON files, API keys, or real customer documents. Never send Amin's credentials to another contributor. Cloud access will use each person's own approved identity and least-privilege IAM role in a later phase.

## Daily Git workflow

Before beginning new work:

```powershell
cd C:\Physics\claimflow-agent
git switch main
git pull origin main
npm ci
git switch -c feature/short-description
npm run dev
```

`npm ci` is safe to repeat and ensures dependencies match the lockfile. If the branch already exists, use:

```powershell
git switch feature/short-description
git merge main
```

Develop on a feature branch, make focused commits, push that branch, and open a Pull Request. Do not develop or push feature commits directly on `main`.

## Quality checks

Run these commands from the repository root before opening a Pull Request:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

GitHub Actions runs the same checks. A Pull Request should be merged only after they pass and another team member reviews it.

## Where to make changes

| Work | Location |
|---|---|
| React pages and components | `apps/web/src` |
| Fastify routes and Backend logic | `apps/api/src` |
| Shared schemas and TypeScript types | `packages/domain/src` |
| Environment parsing and shared config | `packages/config/src` |
| Synthetic, non-sensitive test cases | `sample-data/cases` |
| Product and engineering documentation | `docs` |

Changes to shared schemas can affect both applications, so run the full quality suite after editing `packages/domain`.

## Troubleshooting

### The browser reports `API returned 502`

The Frontend is running but cannot reach the Backend on port 8080. Start the Backend in a separate PowerShell window:

```powershell
cd C:\Physics\claimflow-agent
npm run dev:api
```

Then verify `/health` with `Invoke-RestMethod` and reload the browser. Read the Backend terminal for the actual startup error if the health check fails.

### Port 8080 or 5173 is already in use

Inspect the port and process before stopping anything:

```powershell
Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
Get-Process -Id <PID>
```

Close the terminal that owns the old development server. Only if you have confirmed that the PID belongs to an obsolete Node.js process, stop that exact process:

```powershell
Stop-Process -Id <PID>
```

### `npm ci` fails with a missing or corrupt package file

An interrupted installation can leave `node_modules` incomplete. From the repository root:

```powershell
Remove-Item -Recurse -Force node_modules
npm cache verify
npm ci
```

Do not delete or regenerate `package-lock.json` to work around the problem. If the failure remains, copy the complete npm error and the referenced log path into the team issue.

### The wrong Node.js, npm, or TypeScript version is used

```powershell
node --version
npm --version
npm exec tsc -- --version
```

Expected results are Node.js 22.x or newer, npm 11.9.0, and TypeScript 6.0.3. Reopen PowerShell after changing a system installation so that `PATH` is refreshed.

### A pull is blocked by local changes

Do not discard work blindly. Check it first:

```powershell
git status
git diff
```

Commit valid work on its feature branch or ask the team before stashing/removing unfamiliar files.

## When Google Cloud becomes necessary

Google Cloud setup begins when the team integrates Firestore, Cloud Storage, Gemini/Vertex AI, Document AI, or deploys to Cloud Run. At that point, approved developers will install the Google Cloud CLI, sign in with their own Google identity, select the team project, and receive only the IAM roles their tasks require. Local Phase 1–2 development remains available without cloud credentials.
