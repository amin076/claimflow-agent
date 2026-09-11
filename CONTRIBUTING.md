# Contributing to ClaimFlow AI

## Before the official build starts

Only planning, architecture, scope, issues, and synthetic-data design may be added. Do not add executable product code before the official hackathon start.

## Workflow

1. Create or claim an issue with a clear acceptance criterion.
2. Branch from the latest `main`.
3. Use a short branch name such as `feature/review-queue`.
4. Keep commits focused and never commit credentials or real customer data.
5. Open a pull request and link the issue.
6. Ask the other team member to review.
7. Prefer squash merge after checks pass.

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
