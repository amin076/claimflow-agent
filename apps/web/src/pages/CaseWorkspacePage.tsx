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
import { caseApi } from '../services/caseApi.js';

const errorMessage = (cause: unknown) =>
  cause instanceof Error ? cause.message : 'An unexpected error occurred.';

export const CaseWorkspacePage = () => {
  const [cases, setCases] = useState<ClaimCase[]>([]);
  const [selected, setSelected] = useState<ClaimCase>();
  const [documentType, setDocumentType] = useState<DocumentType>('CLAIM_FORM');
  const [uploadFile, setUploadFile] = useState<File>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const refresh = useCallback(async (preferredId?: string) => {
    const nextCases = await caseApi.list();
    setCases(nextCases);
    setSelected((current) => {
      const id = preferredId ?? current?.id;
      return nextCases.find((claim) => claim.id === id) ?? nextCases[0];
    });
  }, []);

  useEffect(() => {
    refresh()
      .catch((cause: unknown) => setError(errorMessage(cause)))
      .finally(() => setLoading(false));
  }, [refresh]);

  const run = async (action: () => Promise<ClaimCase>, success: string) => {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const claim = await action();
      setSelected(claim);
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
  ) => {
    if (!selected) return;
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
      reason:
        action === 'CORRECT'
          ? 'Corrected during local human review.'
          : `${action.replaceAll('_', ' ')} selected during local human review.`,
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
            Create a synthetic case, upload a document, run deterministic extraction, and review
            every uncertain result with its source evidence.
          </Typography>
        </Box>

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
              <CaseList cases={cases} selectedId={selected?.id} onSelect={setSelected} />
            </Stack>

            {selected ? (
              <Stack spacing={3}>
                <CaseSummary claim={selected} />
                {selected.status === 'DRAFT' && (
                  <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
                    <Stack spacing={2}>
                      <Typography variant="h6" component="h3" sx={{ fontWeight: 750 }}>
                        1. Upload a synthetic document
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
                      <Button variant="outlined" component="label" disabled={busy}>
                        Choose synthetic file
                        <input
                          hidden
                          type="file"
                          accept="application/pdf,image/jpeg,image/png"
                          onChange={(event) => setUploadFile(event.target.files?.[0])}
                        />
                      </Button>
                      <Typography variant="body2">
                        {uploadFile?.name ?? 'No file selected'}
                      </Typography>
                      <Button
                        variant="contained"
                        disabled={busy || !uploadFile}
                        onClick={() => {
                          if (uploadFile)
                            void run(
                              () => caseApi.upload(selected.id, uploadFile, documentType),
                              'Synthetic file uploaded.',
                            );
                        }}
                      >
                        Upload synthetic document
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
                        Run deterministic mock extraction and validation. No AI model is called.
                        These are demo results, not facts extracted from your upload.
                      </Typography>
                      <Button
                        variant="contained"
                        color="secondary"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () => caseApi.process(selected.id),
                            'Mock extraction completed. Human review is required.',
                          )
                        }
                      >
                        {busy ? 'Processing…' : 'Run mock processing'}
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
                <ExtractedFieldList
                  fields={selected.fields}
                  busy={busy}
                  onReview={(action, fieldName, value) => review(action, fieldName, value)}
                />
                <IssueList
                  issues={selected.issues}
                  busy={busy}
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
