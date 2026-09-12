# Contributing to ClaimFlow AI

## Development setup

Follow the [Local Development Guide](docs/local-development.md) before taking an
issue. It documents the supported Node.js, npm, and TypeScript versions and
explains how to run the Frontend and Backend together or separately.

## Workflow

1. Create or claim an issue with a clear acceptance criterion.
2. Pull the latest `main` and confirm the existing checks pass.
3. Use a short branch name such as `feature/review-queue`.
4. Keep commits focused and never commit credentials or real customer data.
5. Open a pull request and link the issue.
6. Ask the other team member to review.
7. Prefer squash merge after checks pass.

Never commit `.env`, Google Application Default Credentials, service-account
JSON files, API keys, real customer documents, or unredacted personal data.

## Branch ownership

- `feature/agent-*` and `feature/backend-*`: primarily Amin.
- `feature/ui-*` and `feature/review-*`: primarily Behzad.
- Integration and demo branches require joint review.

## Definition of done

A change is done when it has tests appropriate to its risk, documented limitations, no secrets or personal data, and a reproducible verification note in the pull request.

## Commit style

Use Conventional Commit-style messages:

- `docs: clarify review policy`
- `feat: add document quality assessment`
- `test: cover low-confidence routing`
- `fix: preserve evidence references`
