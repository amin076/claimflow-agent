# Synthetic Sample Data

This directory contains fictional test manifests and will contain synthetic documents used by
the local workflow and repeatable evaluation.

Do not commit:

- real customer or employee information;
- real claim numbers, addresses, phone numbers, emails, or signatures;
- confidential company documents;
- API keys or service-account files;
- copyrighted forms without permission.

Each future fixture should include its expected document type, expected fields, deliberately ambiguous fields, expected quality warnings, and expected contradictions so it can support repeatable evaluation.

## Case manifests

- `cases/complete-case.json` — clear input expected to become `READY`;
- `cases/needs-review-case.json` — low confidence and contradictory evidence;
- `cases/needs-input-case.json` — a required field is absent.

The manifests describe expectations without containing real personal information. Binary sample
documents will be added only when their origin and synthetic-data status are documented.
