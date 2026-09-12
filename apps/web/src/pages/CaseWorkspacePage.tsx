import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
  TextField,
} from '@mui/material';
import type { ClaimCase, ClaimFieldName, DocumentType, ReviewCaseInput } from '@claimflow/domain';
import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell.js';
import { AuditTimeline } from '../components/AuditTimeline.js';
import { CaseList } from '../components/CaseList.js';
import { CaseSummary } from '../components/CaseSummary.js';
import { ExtractedFieldList } from '../components/ExtractedFieldList.js';
import { IssueList } from '../components/IssueList.js';
import { NewCaseForm } from '../components/NewCaseForm.js';
import { AgentRunList } from '../components/AgentRunList.js';
import { MissingFieldForm } from '../components/MissingFieldForm.js';
import { FileDropzone } from '../components/FileDropzone.js';
import { caseApi, type RuntimeInfo } from '../services/caseApi.js';

const errorMessage = (cause: unknown) =>
  cause instanceof Error ? cause.message : 'An unexpected error occurred.';

export const CaseWorkspacePage = () => {
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo>();
  const [reviewReason, setReviewReason] = useState('');
  const [cases, setCases] = useState<ClaimCase[]>([]);
  const [selected, setSelected] = useState<ClaimCase>();
  const [documentType, setDocumentType] = useState<DocumentType>('CLAIM_FORM');
  const [replaceId, setReplaceId] = useState<string>();
  const [uploadFile, setUploadFile] = useState<File>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    setReplaceId(undefined);
    setUploadFile(undefined);
    setReviewReason('');
  }, [selected?.id]);

  const refresh = useCallback(async (preferredId?: string) => {
    const nextCases = await caseApi.list();
    setCases(nextCases);
    setSelected((current) => {
      const id = preferredId ?? current?.id;
      return nextCases.find((claim) => claim.id === id) ?? nextCases[0];
    });
  }, []);

  useEffect(() => {
    Promise.all([refresh(), caseApi.config().then(setRuntimeInfo)])
      .catch((cause: unknown) => setError(errorMessage(cause)))
      .finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    if (!busy) return;
    let active = true;
    const timer = setInterval(() => {
      void caseApi
        .list()
        .then((nextCases) => {
          if (!active) return;
          setCases(nextCases);
          setSelected((current) => nextCases.find((claim) => claim.id === current?.id) ?? current);
        })
        .catch(() => {
          /* The primary request reports errors; polling is best effort. */
        });
    }, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [busy]);

  const run = async (action: () => Promise<ClaimCase>, success: string) => {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const claim = await action();
      setSelected(claim);
      setReplaceId(undefined);
      setUploadFile(undefined);
      await refresh(claim.id);
      setNotice(success);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const review = async (
    action: ReviewCaseInput['action'],
    fieldName?: ClaimFieldName,
    correctedValue?: string,
    evidence?: ReviewCaseInput['evidence'],
  ) => {
    if (!selected) return;
    if (!reviewReason.trim()) {
      setError('Enter a review reason before saving a decision.');
      return;
    }
    const labels: Record<ReviewCaseInput['action'], string> = {
      ACCEPT: 'Accepted by the local reviewer.',
      CORRECT: 'Correction saved with an audit event.',
      REJECT: 'Field rejected by the local reviewer.',
      ESCALATE: 'Case escalated for specialist review.',
      REQUEST_INPUT: 'Case marked as needing more information.',
    };
    const input: ReviewCaseInput = {
      reviewerId: 'local-reviewer',
      action,
      reason: reviewReason.trim(),
      ...(evidence ? { evidence } : {}),
      ...(fieldName ? { fieldName } : {}),
      ...(correctedValue !== undefined ? { correctedValue } : {}),
    };
    await run(() => caseApi.review(selected.id, input), labels[action]);
  };

  return (
    <AppShell>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h3" component="h2" sx={{ fontWeight: 800 }}>
            Human review workspace
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mt: 1, maxWidth: 820 }}>
            Create a synthetic case, upload a document, run the document workflow, and review every
            uncertain result with its source evidence.
          </Typography>
        </Box>

        <Alert severity={runtimeInfo?.aiMode === 'vertex' ? 'info' : 'warning'}>
          {runtimeInfo
            ? runtimeInfo.aiMode === 'vertex'
              ? `Gemini extraction · ${runtimeInfo.model} · ADK workflow. Confidence and excerpts are model estimates; verify them against the original.`
              : 'Mock AI · demo values only. Uploaded content is not interpreted by the mock provider.'
            : 'Loading processing mode…'}
        </Alert>
        {error && (
          <Alert severity="error" onClose={() => setError(undefined)}>
            {error}
          </Alert>
        )}
        {notice && (
          <Alert severity="success" onClose={() => setNotice(undefined)}>
            {notice}
          </Alert>
        )}

        {loading ? (
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', py: 8 }}>
            <CircularProgress />
            <Typography>Loading cases…</Typography>
          </Stack>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: '340px minmax(0, 1fr)' },
              gap: 3,
              alignItems: 'start',
            }}
          >
            <Stack spacing={3}>
              <NewCaseForm
                busy={busy}
                onCreate={(title) => run(() => caseApi.create({ title }), 'Draft case created.')}
              />
              <CaseList
                cases={cases}
                selectedId={selected?.id}
                onSelect={(claim) => {
                  if (!busy) setSelected(claim);
                }}
              />
            </Stack>

            {selected ? (
              <Stack spacing={3}>
                <CaseSummary claim={selected} />
                {selected.summary && (
                  <Alert severity="info">
                    {selected.summary} {selected.suggestedNextAction}
                  </Alert>
                )}
                <AgentRunList runs={selected.agentRuns} />
                {selected.status === 'PROCESSING' && (
                  <Alert severity="info">
                    Processing is in progress. If it was interrupted, wait two minutes before
                    recovery.
                    <Button
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => caseApi.recover(selected.id),
                          'Interrupted workflow recovered without another model call.',
                        )
                      }
                    >
                      Recover interrupted run
                    </Button>
                  </Alert>
                )}
                {(selected.status === 'DRAFT' || replaceId) && selected.status !== 'PROCESSING' && (
                  <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
                    <Stack spacing={2}>
                      <Typography variant="h6" component="h3" sx={{ fontWeight: 750 }}>
                        {replaceId
                          ? 'Replace source and invalidate previous output'
                          : '1. Upload a synthetic document'}
                      </Typography>
                      <Alert severity="warning">
                        Synthetic PDF, JPEG or PNG only, up to 5 MiB. Mock extraction returns demo
                        values; it does not read the uploaded file.
                      </Alert>
                      <FormControl fullWidth>
                        <InputLabel id="document-type-label">Document type</InputLabel>
                        <Select
                          labelId="document-type-label"
                          label="Document type"
                          value={documentType}
                          onChange={(event) => setDocumentType(event.target.value as DocumentType)}
                        >
                          <MenuItem value="CLAIM_FORM">Claim form</MenuItem>
                          <MenuItem value="EMAIL">Email</MenuItem>
                          <MenuItem value="DAMAGE_PHOTO">Damage photo</MenuItem>
                          <MenuItem value="INVOICE">Invoice</MenuItem>
                          <MenuItem value="REPORT">Report</MenuItem>
                          <MenuItem value="OTHER">Other</MenuItem>
                        </Select>
                      </FormControl>
                      <FileDropzone
                        file={uploadFile}
                        onFileSelect={setUploadFile}
                        disabled={busy}
                      />
                      <Button
                        variant="contained"
                        disabled={
                          busy || !uploadFile || (!replaceId && selected.documents.length >= 3)
                        }
                        onClick={() => {
                          if (uploadFile)
                            void run(
                              () =>
                                caseApi.upload(selected.id, uploadFile, documentType, replaceId),
                              'Synthetic file uploaded. Processing must be started explicitly.',
                            );
                        }}
                      >
                        {replaceId ? 'Replace source' : 'Upload synthetic document'}
                      </Button>
                    </Stack>
                  </Paper>
                )}
                {selected.status === 'DRAFT' && selected.documents.length > 0 && (
                  <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
                    <Stack spacing={2}>
                      <Typography variant="h6" component="h3" sx={{ fontWeight: 750 }}>
                        2. Process case
                      </Typography>
                      <Typography color="text.secondary">
                        {runtimeInfo?.aiMode === 'vertex'
                          ? 'One bounded Gemini request for all uploaded sources, followed by deterministic checks and human review.'
                          : 'Run the six-step ADK workflow with deterministic mock data. No model is called.'}
                      </Typography>
                      <Button
                        variant="contained"
                        color="secondary"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () => caseApi.process(selected.id),
                            'Workflow finished. Inspect its steps, issues and source evidence.',
                          )
                        }
                      >
                        {busy
                          ? 'Processing…'
                          : runtimeInfo?.aiMode === 'vertex'
                            ? 'Extract with Gemini'
                            : 'Run mock workflow'}
                      </Button>
                    </Stack>
                  </Paper>
                )}
                {selected.documents.length > 0 && (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="h6">Source documents</Typography>
                    {selected.documents.map((document) => (
                      <Box key={document.id} sx={{ mt: 1 }}>
                        <Typography variant="body2">{document.filename}</Typography>
                        {selected.status !== 'PROCESSING' && (
                          <Button
                            disabled={busy}
                            onClick={() => {
                              setReplaceId(document.id);
                              setUploadFile(undefined);
                            }}
                          >
                            Replace this source
                          </Button>
                        )}
                        {document.storageUri.endsWith(`/documents/${document.id}/original`) ? (
                          <Button
                            component="a"
                            href={`/api/cases/${encodeURIComponent(selected.id)}/documents/${encodeURIComponent(document.id)}/content`}
                          >
                            Download original
                          </Button>
                        ) : (
                          <Typography variant="caption">Demo metadata; no file attached</Typography>
                        )}
                      </Box>
                    ))}
                  </Paper>
                )}
                {selected.status !== 'DRAFT' && (
                  <TextField
                    label="Reason for this review decision"
                    value={reviewReason}
                    onChange={(event) => setReviewReason(event.target.value)}
                    multiline
                    fullWidth
                    helperText="Record what you checked against the source. Required for accept, correct, reject or routing."
                  />
                )}
                <MissingFieldForm
                  key={selected.id}
                  claim={selected}
                  busy={busy || selected.status === 'PROCESSING'}
                  onCorrect={(field, value, evidence) => review('CORRECT', field, value, evidence)}
                />
                <ExtractedFieldList
                  caseId={selected.id}
                  fields={selected.fields}
                  busy={busy || selected.status === 'PROCESSING'}
                  onReview={(action, fieldName, value) => review(action, fieldName, value)}
                />
                <IssueList
                  issues={selected.issues}
                  busy={busy || selected.status === 'PROCESSING'}
                  onRoute={(action) => review(action)}
                />
                <AuditTimeline events={selected.auditEvents} />
                <Divider />
                <Typography variant="body2" color="text.secondary">
                  ClaimFlow AI prepares evidence for a person. It does not approve or deny claims.
                </Typography>
              </Stack>
            ) : (
              <Paper variant="outlined" sx={{ p: 5, textAlign: 'center' }}>
                <Typography variant="h6">Create a synthetic case to begin.</Typography>
              </Paper>
            )}
          </Box>
        )}
      </Stack>
    </AppShell>
  );
};
