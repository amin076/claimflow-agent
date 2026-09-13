# Human Review Policy

## Review is mandatory when

- confidence falls below the configured threshold;
- documents disagree on a material field;
- a required field is missing;
- the image is unreadable or incomplete;
- a value fails deterministic validation;
- an action could contact a person or change an external system;
- the model proposes a claim, legal, safety, or financial decision.

## Reviewer actions

- **Accept** a non-conflicted proposed value with its evidence.
- **Edit / correct** a value and record the correction reason.
- **Reject** a proposal without replacing it.
- **Request better evidence** when the source is insufficient.
- **Create a voice clarification** for an eligible open issue.
- **Edit and approve the exact clarification question** before external contact.
- **Explicitly start the approved call** to the configured synthetic test participant.
- **Review the returned transcript as evidence** and decide whether a canonical correction is supported.
- **Escalate** when domain authority is required.

## Voice clarification rules

- Drafting a question does not authorize a call.
- Approval applies to the exact question text and current case/issue state.
- The call requires a separate explicit action after approval.
- The browser cannot choose an arbitrary destination; the demo destination is fixed server-side.
- A transcript is machine-generated evidence, not a verified fact.
- A transcript must never automatically change a field.
- `COMPLETED` means a transcript arrived; it does not mean the issue is resolved.
- `RESOLVED` requires a valid human canonical correction and deterministic revalidation.
- Ambiguous call-initiation failures are never automatically redialed.

## General rules

- The original extraction and source evidence remain in history after correction.
- Historical contradictions remain auditable even after the UI marks the field **Resolved by human**.
- Approval applies to a specific version of the case.
- A changed source document invalidates affected approvals/clarifications.
- No bulk “approve all” action is planned for the MVP.
- The UI must distinguish model proposals, machine transcripts, and human-corrected canonical values.
- ClaimFlow does not autonomously approve/deny claims, determine liability, or make financial/legal decisions.
