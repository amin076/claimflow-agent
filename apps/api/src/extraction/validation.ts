import { randomUUID } from 'node:crypto';
import {
  type ClaimCase,
  type ClaimFieldName,
  type ExtractedField,
  type ValidationIssue,
} from '@claimflow/domain';
import type { ModelExtraction } from './schema.js';

export const REQUIRED_FIELDS: ClaimFieldName[] = [
  'claimant.fullName',
  'incident.date',
  'incident.address',
  'damage.description',
];
const normalized = (name: ClaimFieldName, value: string) =>
  name === 'vehicle.registration'
    ? value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    : value.trim().toLowerCase().replace(/\s+/g, ' ');

const unique = (values: string[]) => [...new Set(values)];

const sameDocumentScalarConflict = (name: ClaimFieldName, value: string, evidenceCount: number) => {
  if (evidenceCount < 2) return [];
  if (name === 'incident.date') {
    return unique(value.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? []);
  }
  if (name === 'damage.estimatedAmount') {
    return unique(
      (value.match(/\b\d[\d,]*(?:\.\d{1,2})?\b/g) ?? []).map((amount) => amount.replace(/,/g, '')),
    );
  }
  return [];
};

const hasConflictMarker = (reasons: string[]) =>
  reasons.some((reason) => reason.startsWith('Conflicting source values:'));

export function materialize(result: ModelExtraction): ExtractedField[] {
  const groups = new Map<ClaimFieldName, ModelExtraction['fields']>();
  for (const field of result.fields)
    groups.set(field.name, [...(groups.get(field.name) ?? []), field]);
  return [...groups].map(([name, values]) => {
    const modelReasons = unique(values.flatMap((value) => value.uncertaintyReasons));
    const crossRecordConflict =
      new Set(values.map((value) => normalized(name, value.value))).size > 1;
    const intrinsicCandidates = unique(
      values.flatMap((value) =>
        sameDocumentScalarConflict(name, value.value, value.evidence.length),
      ),
    );
    const inferredConflict = intrinsicCandidates.length > 1;
    const generatedConflictReason = crossRecordConflict
      ? `Conflicting source values: ${values
          .map((value) => value.value)
          .join(' / ')
          .slice(0, 1000)}`
      : inferredConflict
        ? `Conflicting source values: ${intrinsicCandidates.join(' / ').slice(0, 1000)}`
        : undefined;
    const uncertaintyReasons = [
      ...modelReasons,
      ...(generatedConflictReason && !hasConflictMarker(modelReasons)
        ? [generatedConflictReason]
        : []),
    ];

    return {
      id: `field-${randomUUID()}`,
      name,
      value: values[0]!.value,
      displayValue: values[0]!.value,
      confidence: Math.min(...values.map((value) => value.confidence)),
      status: 'PROPOSED',
      requiresReview: true,
      evidence: values.flatMap((value) =>
        value.evidence.map((evidence) => ({ ...evidence, id: `evidence-${randomUUID()}` })),
      ),
      uncertaintyReasons,
    };
  });
}
export function validateFields(claim: ClaimCase, now = new Date()): ValidationIssue[] {
  const timestamp = now.toISOString();
  const issues: ValidationIssue[] = [];
  const add = (
    type: ValidationIssue['type'],
    message: string,
    fieldNames: ClaimFieldName[],
    severity: ValidationIssue['severity'] = 'BLOCKING',
  ) =>
    issues.push({
      id: `issue-${randomUUID()}`,
      caseId: claim.id,
      type,
      severity,
      status: 'OPEN',
      message,
      fieldNames,
      documentIds: [
        ...new Set(
          claim.fields
            .filter((field) => fieldNames.includes(field.name))
            .flatMap((field) => field.evidence.map((e) => e.documentId)),
        ),
      ],
      createdAt: timestamp,
    });
  for (const name of REQUIRED_FIELDS) {
    const field = claim.fields.find((candidate) => candidate.name === name);
    if (
      !field ||
      field.status === 'REJECTED' ||
      field.value === null ||
      String(field.value).trim() === ''
    )
      add('MISSING_REQUIRED_FIELD', `${name} needs a supported value.`, [name]);
  }
  for (const field of claim.fields) {
    if (field.status === 'REJECTED') {
      add('BUSINESS_RULE', `${field.name} was rejected; supply a supported correction.`, [
        field.name,
      ]);
      continue;
    }
    const value = String(field.value ?? '').trim();
    const hasConflict = hasConflictMarker(field.uncertaintyReasons);
    const unresolvedConflict = hasConflict && field.status !== 'CORRECTED';
    if (field.status === 'PROPOSED') {
      add(
        'BUSINESS_RULE',
        `${field.name} requires human verification against its source.`,
        [field.name],
        'WARNING',
      );
      if (field.confidence < 0.8)
        add(
          'LOW_CONFIDENCE',
          `${field.name} has model confidence below 80%.`,
          [field.name],
          'WARNING',
        );
      if (hasConflict)
        add(
          'CONTRADICTION',
          `${field.name} has conflicting source values. Review the cited evidence and save one canonical correction with a reason.`,
          [field.name],
        );
    }
    if (field.status === 'ACCEPTED' && hasConflict)
      add(
        'CONTRADICTION',
        `${field.name} requires a reasoned correction; acceptance alone does not resolve a conflict.`,
        [field.name],
      );
    if (field.name === 'incident.date' && !unresolvedConflict) {
      const parsed = new Date(`${value}T00:00:00.000Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== value
      )
        add('INVALID_FORMAT', 'Incident date must be a real date in YYYY-MM-DD format.', [
          field.name,
        ]);
      else if (value > timestamp.slice(0, 10))
        add('BUSINESS_RULE', 'Incident date cannot be in the future.', [field.name]);
    }
    if (field.name === 'claimant.email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      add('INVALID_FORMAT', 'Email format is invalid.', [field.name]);
    if (
      field.name === 'damage.estimatedAmount' &&
      !unresolvedConflict &&
      (!/^\d+(\.\d{1,2})?$/.test(value) || !Number.isFinite(Number(value)))
    )
      add(
        'INVALID_FORMAT',
        'Damage amount must be a non-negative number without currency symbols.',
        [field.name],
      );
  }
  if (claim.documents.some((document) => !document.quality.usable))
    add(
      'DOCUMENT_QUALITY',
      'At least one source is unassessed or unreadable. Provide a readable replacement in a new case or escalate.',
      [],
    );
  return issues;
}
export function planCase(
  claim: ClaimCase,
  route?: 'REQUEST_INPUT' | 'ESCALATE',
): Pick<ClaimCase, 'status' | 'summary' | 'suggestedNextAction'> {
  const open = claim.issues.filter((issue) => issue.status === 'OPEN');
  const needsInput = open.some(
    (issue) => issue.type === 'MISSING_REQUIRED_FIELD' || issue.type === 'DOCUMENT_QUALITY',
  );
  const status =
    route === 'ESCALATE'
      ? 'NEEDS_REVIEW'
      : route === 'REQUEST_INPUT' || needsInput
        ? 'NEEDS_INPUT'
        : open.length ||
            claim.fields.some((field) => field.requiresReview || field.status === 'REJECTED')
          ? 'NEEDS_REVIEW'
          : claim.fields.length
            ? 'READY'
            : 'NEEDS_INPUT';
  return {
    status,
    summary: `${claim.documents.length} source document(s), ${claim.fields.length} field(s), ${open.length} open issue(s).`,
    suggestedNextAction:
      status === 'READY'
        ? 'Evidence preparation complete; an authorized person must make any claim decision.'
        : status === 'NEEDS_INPUT'
          ? 'Supply missing evidence or escalate to a person.'
          : 'Review source evidence and resolve flagged values; no claim decision has been made.',
  };
}
