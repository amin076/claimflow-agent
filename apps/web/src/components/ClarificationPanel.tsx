import { useState } from 'react';
import { Alert, Box, Button, Chip, Paper, Stack, TextField, Typography } from '@mui/material';
import type { ClaimCase, ClarificationRequest } from '@claimflow/domain';
import { caseApi } from '../services/caseApi.js';

type Props = {
  claim: ClaimCase;
  busy: boolean;
  run: (action: () => Promise<ClaimCase>, message: string) => Promise<void>;
};

function RequestCard({
  item,
  claim,
  busy,
  run,
  token,
}: Props & { item: ClarificationRequest; token: string }) {
  const [question, setQuestion] = useState(item.question);
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const field = claim.fields.find((candidate) => candidate.name === item.fieldName);
  const resolvedValue = field?.displayValue;
  const resolved = item.status === 'RESOLVED';

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, md: 2.5 },
        borderRadius: 3,
        bgcolor: resolved ? '#fbfefd' : '#ffffff',
        borderColor: resolved ? '#d8ebe2' : '#e2eaf0',
        boxShadow: '0 8px 24px rgba(17, 52, 70, .045)',
      }}
      id={item.response?.id}
    >
      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
        >
          <Box>
            <Typography sx={{ fontWeight: 820, fontSize: '1.02rem' }}>{item.fieldName}</Typography>
            <Typography variant="caption" color="text.secondary">
              Voice clarification evidence workflow
            </Typography>
          </Box>
          <Chip
            label={item.status}
            size="small"
            color={resolved ? 'success' : item.status === 'FAILED' ? 'error' : 'info'}
            variant={resolved ? 'filled' : 'outlined'}
          />
        </Stack>

        {resolved ? (
          <Alert severity="success">
            Resolved by human review{resolvedValue ? ` · canonical value: ${resolvedValue}` : ''}.
            The source conflict and transcript remain attached as evidence.
          </Alert>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {item.context}
          </Typography>
        )}

        {item.drafting?.failureClass && !resolved && (
          <Alert severity="info">
            AI wording unavailable; safe template used. Review before approval.
          </Alert>
        )}
        {item.drafting?.failureClass && resolved && (
          <Typography variant="caption" color="text.secondary">
            The original call used the safe template after optional AI wording was unavailable; the
            reviewer still approved the exact question before dialing.
          </Typography>
        )}
        {item.drafting?.source === 'GEMINI' && (
          <Typography variant="caption" color="text.secondary">
            Gemini-assisted draft · human approval {resolved ? 'was required' : 'required'}
          </Typography>
        )}

        {item.candidateValues.length > 0 && (
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary' }}>
              {resolved ? 'ORIGINAL CANDIDATE VALUES' : 'CANDIDATE VALUES'}
            </Typography>
            <Stack direction="row" spacing={0.8} sx={{ mt: 0.7, flexWrap: 'wrap', rowGap: 0.8 }}>
              {item.candidateValues.map((candidate) => (
                <Chip
                  key={candidate}
                  label={candidate}
                  size="small"
                  variant="outlined"
                  sx={{ bgcolor: '#f8fafb', borderColor: '#dce6eb' }}
                />
              ))}
            </Stack>
          </Box>
        )}

        {field?.evidence.some((evidence) => evidence.documentId) && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              gap: 1,
            }}
          >
            {field.evidence
              .filter((evidence) => evidence.documentId)
              .map((evidence) => (
                <Box
                  key={evidence.id}
                  sx={{
                    p: 1.4,
                    borderRadius: 2.25,
                    border: '1px solid #e3ebef',
                    bgcolor: '#f9fbfc',
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 800 }}>
                    SOURCE {evidence.page ? `· PAGE ${evidence.page}` : ''}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {evidence.excerpt}
                  </Typography>
                </Box>
              ))}
          </Box>
        )}

        <TextField
          label={
            item.status === 'DRAFT'
              ? 'Proposed clarification question'
              : 'Approved clarification question'
          }
          multiline
          minRows={2}
          value={question}
          disabled={item.status !== 'DRAFT' || busy}
          onChange={(event) => setQuestion(event.target.value)}
        />

        {item.status === 'DRAFT' && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="contained"
              disabled={busy || !token || !question.trim()}
              onClick={() =>
                run(
                  () => caseApi.clarification(claim.id, `${item.id}/approve`, { question }, token),
                  'Question approved. Start the call explicitly when ready.',
                )
              }
            >
              Approve question
            </Button>
            <Button
              color="inherit"
              disabled={busy || !token}
              onClick={() =>
                run(
                  () => caseApi.clarification(claim.id, `${item.id}/cancel`, {}, token),
                  'Clarification cancelled.',
                )
              }
            >
              Cancel clarification
            </Button>
          </Stack>
        )}

        {item.status === 'APPROVED' && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="contained"
              disabled={busy || !token}
              onClick={() =>
                run(
                  () => caseApi.clarification(claim.id, `${item.id}/call`, {}, token),
                  'Call request handled. Check the status below.',
                )
              }
            >
              Start ElevenLabs call
            </Button>
            <Button
              color="inherit"
              disabled={busy || !token}
              onClick={() =>
                run(
                  () => caseApi.clarification(claim.id, `${item.id}/cancel`, {}, token),
                  'Clarification cancelled.',
                )
              }
            >
              Cancel clarification
            </Button>
          </Stack>
        )}

        {item.status === 'CALLING' && (
          <Alert severity="info">
            Waiting for the post-call response. Refresh the case below. If interrupted, check
            ElevenLabs before starting another clarification.
          </Alert>
        )}
        {item.errorSummary && (
          <Alert severity="warning">
            {item.errorSummary}. Check ElevenLabs before another attempt; the system never retries
            calls automatically.
          </Alert>
        )}

        {item.externalConversationId && (
          <Box
            sx={{
              px: 1.5,
              py: 1.1,
              borderRadius: 2,
              bgcolor: '#f7fafb',
              border: '1px solid #e6edf1',
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              Conversation: {item.externalConversationId} · Call: {item.externalCallId}
            </Typography>
          </Box>
        )}

        {item.response && (
          <>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                Clarification transcript
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Received {item.response.receivedAt}
              </Typography>
            </Stack>
            <Alert severity={resolved ? 'success' : 'info'}>
              {resolved
                ? 'Transcript retained as supporting evidence. The field changed only after a human saved the canonical correction.'
                : 'Transcript is machine transcription, not a verified fact. Only a human correction resolves this field.'}
            </Alert>
            {item.response.transcriptTruncated && (
              <Alert severity="warning">
                Transcript was truncated to the demo storage limit. Verify the full conversation in
                ElevenLabs before correcting.
              </Alert>
            )}
            <Box
              sx={{
                p: 1.75,
                borderRadius: 2.5,
                bgcolor: '#f6faff',
                border: '1px solid #dceaf7',
              }}
            >
              <Stack spacing={1}>
                {item.response.transcript.map((turn, index) => (
                  <Typography
                    key={index}
                    variant="body2"
                    sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                  >
                    <Box
                      component="strong"
                      sx={{ color: turn.role === 'agent' ? '#23629b' : '#13705f' }}
                    >
                      {turn.role}:
                    </Box>{' '}
                    {turn.message}
                  </Typography>
                ))}
              </Stack>
            </Box>

            {item.status === 'COMPLETED' && (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'minmax(0, .7fr) minmax(0, 1.3fr)' },
                  gap: 1.5,
                }}
              >
                <TextField
                  label="Final canonical value"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  helperText="Dates: YYYY-MM-DD; amounts: number only."
                />
                <TextField
                  label="Reason for this correction"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
                <Button
                  variant="contained"
                  sx={{ gridColumn: { md: '1 / -1' }, justifySelf: { md: 'end' } }}
                  disabled={busy || !token || !value.trim() || !reason.trim()}
                  onClick={() =>
                    run(
                      () =>
                        caseApi.review(
                          claim.id,
                          {
                            reviewerId: 'voice-reviewer',
                            action: 'CORRECT',
                            fieldName: item.fieldName,
                            correctedValue: value,
                            reason,
                            clarificationResponseId: item.response!.id,
                          },
                          token,
                        ),
                      'Human correction saved; deterministic validation rerun.',
                    )
                  }
                >
                  Save human canonical correction
                </Button>
              </Box>
            )}
          </>
        )}
      </Stack>
    </Paper>
  );
}

export function ClarificationPanel(props: Props) {
  const [token, setToken] = useState('');
  const { claim, busy, run } = props;
  const issues = claim.issues.filter(
    (issue) =>
      issue.status === 'OPEN' &&
      ['CONTRADICTION', 'MISSING_REQUIRED_FIELD', 'LOW_CONFIDENCE'].includes(issue.type),
  );

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3.5 }}>
      <Stack spacing={2.25}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
        >
          <Box>
            <Typography variant="h6">Voice clarification · ElevenLabs</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
              Human-approved outreach when source documents cannot settle an important value.
            </Typography>
          </Box>
          <Chip
            label="HUMAN APPROVAL REQUIRED"
            size="small"
            sx={{ bgcolor: '#edf8f4', color: '#176b4c', border: '1px solid #d4eee3' }}
          />
        </Stack>

        <Alert severity="warning">
          Synthetic demo only. Calls go only to the configured test participant. Review and approve
          the exact question before starting a call. No claim approval or denial.
        </Alert>

        <TextField
          type="password"
          label="Voice reviewer key"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          helperText="Held only in this screen's memory. Required to draft, approve, call and save a voice-evidence correction."
        />

        {issues.length > 0 && (
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary' }}>
              AVAILABLE CLARIFICATIONS
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 1 }}>
              {issues.flatMap((issue) =>
                issue.fieldNames.map((fieldName) => (
                  <Button
                    key={`${issue.id}-${fieldName}`}
                    variant="outlined"
                    disabled={
                      busy ||
                      !token ||
                      ['DRAFT', 'PROCESSING'].includes(claim.status) ||
                      claim.clarifications?.some(
                        (item) =>
                          item.fieldName === fieldName &&
                          ['DRAFT', 'APPROVED', 'CALLING'].includes(item.status),
                      )
                    }
                    onClick={() =>
                      run(
                        () =>
                          caseApi.clarification(
                            claim.id,
                            '',
                            { issueId: issue.id, fieldName },
                            token,
                          ),
                        'Draft prepared. Review and edit the question before approval.',
                      )
                    }
                  >
                    Call for clarification · {fieldName}
                  </Button>
                )),
              )}
            </Stack>
          </Box>
        )}

        {(claim.clarifications ?? []).map((item) => (
          <RequestCard key={item.id} {...props} item={item} token={token} />
        ))}

        <Button
          variant="text"
          disabled={busy}
          sx={{ alignSelf: 'flex-end' }}
          onClick={() => run(() => caseApi.get(claim.id), 'Clarification status refreshed.')}
        >
          Refresh call status
        </Button>
      </Stack>
    </Paper>
  );
}
