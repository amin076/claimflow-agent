import { randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { ClaimCaseSchema, type ClaimCase, type AuditEvent, type AgentRun } from '@claimflow/domain';
import type { CaseRepository } from '../persistence.js';
import { ApiError } from '../errors.js';
import { documentKey, validateDocument, type DocumentStorage } from '../documentStorage.js';
import type { ExtractionDocument, ExtractionProvider, ExtractionResponse } from './provider.js';
import {
  ModelOutputValidationError,
  parseExtraction,
  PROMPT_VERSION,
  type ModelExtraction,
} from './schema.js';
import { materialize, planCase, validateFields } from './validation.js';
import { runAdkWorkflow, STEPS, type StepName } from './adkWorkflow.js';

const LEASE_MS = 120_000;
const stamp = () => new Date().toISOString();
function audit(
  claim: ClaimCase,
  action: string,
  summary: string,
  outcome: AuditEvent['outcome'] = 'SUCCESS',
): AuditEvent {
  return {
    id: `audit-${randomUUID()}`,
    caseId: claim.id,
    timestamp: stamp(),
    actorType: 'SYSTEM',
    actorId: 'claimflow-adk',
    action,
    outcome,
    summary,
    inputReferences: claim.documents.map((d) => d.id),
    outputReferences: claim.processingId ? [claim.processingId] : [],
  };
}
function active(claim: ClaimCase, operation: string) {
  if (claim.status !== 'PROCESSING' || claim.processingId !== operation)
    throw new ApiError(409, 'STALE_PROCESSING', 'This workflow no longer owns the case.');
}
function failureMessage(error: unknown): string {
  if (error instanceof ApiError) return `${error.code}: ${error.message}`;
  const code =
    (error as { status?: number; code?: number })?.status ?? (error as { code?: number })?.code;
  if (code === 401 || code === 403)
    return 'VERTEX_ACCESS_DENIED: Check the runtime Vertex AI permission and API activation.';
  if (code === 404)
    return 'MODEL_OR_SOURCE_UNAVAILABLE: Check model, location and source file access.';
  if (code === 429)
    return 'VERTEX_RATE_LIMIT: Quota or rate limit reached; no automatic retry was made.';
  return 'EXTRACTION_FAILED: Model, source or workflow failed. No generated facts were saved. Review the source or try a new case.';
}

export class ExtractionService {
  constructor(
    private readonly cases: CaseRepository,
    private readonly documents: DocumentStorage,
    private readonly provider: ExtractionProvider,
    private readonly timeoutMs = 40_000,
    private readonly mock = false,
  ) {}
  async recover(id: string) {
    return this.cases.update(id, (claim) => {
      if (claim.status !== 'PROCESSING' || !claim.processingStartedAt)
        throw new ApiError(409, 'NOT_PROCESSING', 'There is no interrupted workflow to recover.');
      if (Date.now() - Date.parse(claim.processingStartedAt) < LEASE_MS)
        throw new ApiError(
          409,
          'STILL_PROCESSING',
          'Wait two minutes from the start before recovering.',
        );
      return this.failed(
        claim,
        'WORKFLOW_INTERRUPTED: No automatic rerun was made. Review the source or create a new case.',
      );
    });
  }
  private failed(claim: ClaimCase, message: string): ClaimCase {
    const timestamp = stamp();
    return ClaimCaseSchema.parse({
      ...claim,
      status: 'NEEDS_REVIEW',
      updatedAt: timestamp,
      summary: 'Processing failed; no new extracted facts were committed.',
      suggestedNextAction:
        'Review the source and configuration, then create a new case to retry explicitly.',
      agentRuns: claim.agentRuns.map((run) =>
        run.id.startsWith(`${claim.processingId}-`) && ['QUEUED', 'RUNNING'].includes(run.status)
          ? {
              ...run,
              status: run.status === 'RUNNING' ? 'FAILED' : 'SKIPPED',
              completedAt: timestamp,
              errorSummary: message,
            }
          : run,
      ),
      issues: [
        ...claim.issues,
        {
          id: `issue-${randomUUID()}`,
          caseId: claim.id,
          type: 'INVALID_MODEL_OUTPUT',
          severity: 'BLOCKING',
          status: 'OPEN',
          message,
          fieldNames: [],
          documentIds: claim.documents.map((d) => d.id),
          createdAt: timestamp,
        },
      ],
      auditEvents: [...claim.auditEvents, audit(claim, 'WORKFLOW_FAILED', message, 'FAILURE')],
    });
  }
  async process(id: string): Promise<ClaimCase | undefined> {
    const operation = `pipeline-${randomUUID()}`;
    const initial = await this.cases.update(id, (claim) => {
      if (claim.status !== 'DRAFT')
        throw new ApiError(
          409,
          'CASE_NOT_DRAFT',
          'Process a draft only; completed or failed cases are never automatically charged again.',
        );
      if (!claim.documents.length || claim.documents.length > 3)
        throw new ApiError(
          409,
          'DOCUMENT_COUNT',
          'Upload between one and three synthetic documents.',
        );
      if (claim.documents.some((doc) => !doc.storageUri.endsWith(documentKey(id, doc.id))))
        throw new ApiError(
          409,
          'UPLOAD_REQUIRED',
          'Upload original files before running this workflow.',
        );
      if (Buffer.byteLength(JSON.stringify(claim)) > 500_000)
        throw new ApiError(
          409,
          'CASE_CAPACITY_REACHED',
          'Create a new case; history is near its limit.',
        );
      const timestamp = stamp();
      return {
        ...claim,
        status: 'PROCESSING',
        processingId: operation,
        processingStartedAt: timestamp,
        updatedAt: timestamp,
        agentRuns: [
          ...claim.agentRuns,
          ...STEPS.map((agent): AgentRun => ({
            id: `${operation}-${agent}`,
            caseId: id,
            agent,
            status: 'QUEUED',
            inputReferences: claim.documents.map((doc) => doc.id),
            outputReferences: [],
            ...(agent === 'EXTRACTION'
              ? { model: this.provider.model, promptVersion: PROMPT_VERSION }
              : {}),
          })),
        ],
        auditEvents: [
          ...claim.auditEvents,
          audit(
            { ...claim, processingId: operation },
            'WORKFLOW_STARTED',
            'Started the six-step ADK workflow.',
          ),
        ],
      };
    });
    if (!initial) return undefined;
    let sources: ExtractionDocument[] = [];
    let result: ModelExtraction | undefined;
    let generated: ExtractionResponse | undefined;
    let prepared = initial;
    const tasks: Record<StepName, () => Promise<void>> = {
      INTAKE: async () => {
        sources = await Promise.all(
          initial.documents.map(async (doc) => ({
            id: doc.id,
            bytes: await this.documents.read(documentKey(id, doc.id)),
            mimeType: doc.mimeType,
            pageCount: 1,
          })),
        );
      },
      QUALITY: async () => {
        if (sources.reduce((sum, doc) => sum + doc.bytes.length, 0) > 10 * 1024 * 1024)
          throw new ApiError(413, 'DOCUMENT_BUDGET', 'Combined files must not exceed 10 MiB.');
        for (const source of sources) {
          validateDocument(source.bytes, source.mimeType);
          if (!this.mock && source.mimeType === 'application/pdf') {
            try {
              source.pageCount = (
                await PDFDocument.load(source.bytes, { updateMetadata: false })
              ).getPageCount();
            } catch {
              throw new ApiError(415, 'INVALID_PDF', 'Use an unencrypted, readable synthetic PDF.');
            }
          }
        }
        if (
          sources.some((source) => source.pageCount < 1) ||
          sources.reduce((sum, source) => sum + source.pageCount, 0) > 5
        )
          throw new ApiError(413, 'PAGE_BUDGET', 'Use at most five pages across all sources.');
      },
      EXTRACTION: async () => {
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          generated = await Promise.race([
            this.provider.generate({ documents: sources, signal: controller.signal }),
            new Promise<never>((_resolve, reject) => {
              timer = setTimeout(() => {
                controller.abort();
                reject(
                  new ApiError(
                    504,
                    'MODEL_TIMEOUT',
                    'The model timed out; no automatic retry was made.',
                  ),
                );
              }, this.timeoutMs);
            }),
          ]);
          if (generated.finishReason !== 'STOP')
            throw new ApiError(
              422,
              'INVALID_MODEL_OUTPUT',
              'MODEL_RESPONSE_INCOMPLETE: The model blocked or truncated its response; no facts were accepted.',
            );
          try {
            result = parseExtraction(
              generated.text,
              new Map(sources.map((source) => [source.id, source.pageCount])),
            );
          } catch (error) {
            if (error instanceof ModelOutputValidationError)
              throw new ApiError(
                422,
                'INVALID_MODEL_OUTPUT',
                `${error.diagnosticCode}: ${error.safeMessage} No facts were accepted.`,
              );
            throw new ApiError(
              422,
              'INVALID_MODEL_OUTPUT',
              'SCHEMA_VALIDATION_FAILED: Model JSON or source references failed validation; no facts were accepted.',
            );
          }
        } finally {
          if (timer) clearTimeout(timer);
        }
      },
      VALIDATION: async () => {
        if (!result) throw new Error('Missing extraction result');
        prepared = {
          ...initial,
          fields: materialize(result),
          documents: initial.documents.map((doc) => ({
            ...doc,
            pageCount: sources.find((source) => source.id === doc.id)!.pageCount,
            quality: {
              score: result!.quality.usable ? 1 : 0,
              usable: result!.quality.usable,
              issues: [],
              notes: [
                'Combined model assessment; not independent OCR verification.',
                ...result!.quality.notes,
              ],
            },
          })),
        };
        prepared.issues = validateFields(prepared);
      },
      CASE_PLANNER: async () => {
        prepared = { ...prepared, ...planCase(prepared) };
      },
      REVIEW_ROUTER: async () => {
        if (prepared.status === 'READY') prepared.status = 'NEEDS_REVIEW';
      },
    };
    try {
      await runAdkWorkflow(async (name) => {
        const started = Date.now();
        const runId = `${operation}-${name}`;
        await this.cases.update(id, (claim) => {
          active(claim, operation);
          return {
            ...claim,
            updatedAt: stamp(),
            agentRuns: claim.agentRuns.map((run) =>
              run.id === runId ? { ...run, status: 'RUNNING', startedAt: stamp() } : run,
            ),
            auditEvents: [
              ...claim.auditEvents,
              audit(claim, 'AGENT_STEP_STARTED', `${name} started.`),
            ],
          };
        });
        try {
          await tasks[name]();
        } catch (error) {
          throw new ApiError(502, 'WORKFLOW_STEP_FAILED', failureMessage(error));
        }
        await this.cases.update(id, (claim) => {
          active(claim, operation);
          return {
            ...claim,
            updatedAt: stamp(),
            agentRuns: claim.agentRuns.map((run) =>
              run.id === runId
                ? {
                    ...run,
                    status: 'SUCCEEDED',
                    completedAt: stamp(),
                    durationMs: Date.now() - started,
                    ...(name === 'EXTRACTION' && generated
                      ? {
                          ...(generated.modelVersion
                            ? { modelVersion: generated.modelVersion }
                            : {}),
                          ...(generated.inputTokens !== undefined
                            ? { inputTokens: generated.inputTokens }
                            : {}),
                          ...(generated.outputTokens !== undefined
                            ? { outputTokens: generated.outputTokens }
                            : {}),
                          ...(generated.totalTokens !== undefined
                            ? { totalTokens: generated.totalTokens }
                            : {}),
                        }
                      : {}),
                  }
                : run,
            ),
            auditEvents: [
              ...claim.auditEvents,
              audit(claim, 'AGENT_STEP_SUCCEEDED', `${name} completed.`),
            ],
          };
        });
      });
      return await this.cases.update(id, (claim) => {
        active(claim, operation);
        return {
          ...claim,
          agentRuns: claim.agentRuns.map((run) =>
            run.id.startsWith(`${operation}-`)
              ? {
                  ...run,
                  outputReferences:
                    run.agent === 'EXTRACTION'
                      ? prepared.fields.map((field) => field.id)
                      : run.agent === 'VALIDATION'
                        ? prepared.issues.map((issue) => issue.id)
                        : [claim.id],
                }
              : run,
          ),
          fields: prepared.fields,
          issues: prepared.issues,
          documents: prepared.documents,
          ...planCase(prepared),
          updatedAt: stamp(),
          auditEvents: [
            ...claim.auditEvents,
            audit(
              claim,
              'CASE_PROCESSED',
              'ADK workflow completed; evidence requires human review.',
            ),
          ],
        };
      });
    } catch (error) {
      // No raw model text, prompt, credential, or provider error is returned or logged.
      return this.cases.update(id, (claim) => {
        active(claim, operation);
        return this.failed(claim, failureMessage(error));
      });
    }
  }
}
