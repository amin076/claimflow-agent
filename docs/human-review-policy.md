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

- **Accept** a proposed value with its evidence.
- **Edit** a value and record the correction reason.
- **Reject** a proposal without replacing it.
- **Request better evidence** when the source is insufficient.
- **Escalate** when domain authority is required.

## Rules

- The original extraction remains in history after correction.
- Approval applies to a specific version of the case.
- A changed source document invalidates affected approvals.
- No bulk “approve all” action is planned for the MVP.
- The UI must distinguish model proposals from verified facts.
