# Security and Privacy

## Hackathon data policy

Use synthetic or properly redacted documents only. Do not upload real customer files, claim records, phone numbers, addresses, signatures, credentials, or health information.

## Planned controls

- Firebase Authentication or an equivalent authenticated demo boundary;
- least-privilege Google Cloud service accounts;
- private Cloud Storage buckets;
- short-lived access to document objects;
- secrets stored outside source control;
- input size and file-type restrictions;
- schema validation for API and model output;
- audit events without unnecessary document text;
- configurable retention and deletion in a future production design.

## AI-specific risks

| Risk | Mitigation |
|---|---|
| Hallucinated field | Evidence link, confidence, typed validation, review |
| Prompt injection in document | Treat document text as untrusted data |
| Sensitive data in logs | Structured minimal logging and redaction |
| Over-automation | Approval gates and restricted tool catalogue |
| Model disagreement | Surface the conflict; do not silently choose |
| Unclear accountability | Record agent, rule, and reviewer decisions |

## Production gaps

The hackathon prototype will not claim compliance certification. A production deployment would require a privacy impact assessment, data-residency review, access-control design, retention policy, incident response, model evaluation, vendor review, and organisation-specific legal approval.
