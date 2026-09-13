import { useState } from 'react';
import { Alert, Button, Paper, Stack, TextField, Typography } from '@mui/material';
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
  const resolvedValue = claim.fields.find((field) => field.name === item.fieldName)?.displayValue;
  const resolved = item.status === 'RESOLVED';
  return (
    <Paper variant="outlined" sx={{ p: 2 }} id={item.response?.id}>
      <Stack spacing={2}>
        <Typography variant="subtitle1">
          {item.fieldName} · {item.status}
        </Typography>
        {resolved ? (
          <Alert severity="success">
            Resolved by human review{resolvedValue ? ` · canonical value: ${resolvedValue}` : ''}.
            The original source conflict and clarification transcript remain attached as evidence.
          </Alert>
        ) : (
          <Typography variant="body2">{item.context}</Typography>
        )}
        {item.drafting?.failureClass && !resolved && (
          <Alert severity="info">
            AI wording unavailable; safe template used. Review before approval.
          </Alert>
        )}
        {item.drafting?.failureClass && resolved && (
          <Typography variant="caption">
            Original call used the safe template after optional AI wording was unavailable; the
            reviewer approved the exact question before dialing.
          </Typography>
        )}
        {item.drafting?.source === 'GEMINI' && (
          <Typography variant="caption">
            Gemini-assisted draft · human approval {resolved ? 'was required' : 'required'}
          </Typography>
        )}
        {item.candidateValues.length > 0 && (
          <Typography>
            {resolved ? 'Original candidate values' : 'Candidate values'}:{' '}
            {item.candidateValues.join(' / ')}
          </Typography>
        )}
        {claim.fields
          .find((field) => field.name === item.fieldName)
          ?.evidence.filter((evidence) => evidence.documentId)
          .map((evidence) => (
            <Typography key={evidence.id} variant="body2">
              Evidence {evidence.page ? `(page ${evidence.page})` : ''}: {evidence.excerpt}
            </Typography>
          ))}
        <TextField
          label={item.status === 'DRAFT' ? 'Proposed clarification question' : 'Approved clarification question'}
          multiline
          value={question}
          disabled={item.status !== 'DRAFT' || busy}
          onChange={(event) => setQuestion(event.target.value)}
        />
        {item.status === 'DRAFT' && (
          <Button
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
        )}
        {item.status === 'APPROVED' && (
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
        )}
        {['DRAFT', 'APPROVED'].includes(item.status) && (
          <Button
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
          <Typography variant="caption">
            Conversation: {item.externalConversationId} · Call: {item.externalCallId}
          </Typography>
        )}
        {item.response && (
          <>
            <Typography variant="subtitle2">
              Clarification evidence · received {item.response.receivedAt}
            </Typography>
            <Alert severity={resolved ? 'success' : 'info'}>
              {resolved
                ? 'Transcript retained as supporting evidence. The field was resolved only after a human saved the canonical correction.'
                : 'Transcript is machine transcription, not a verified fact. Only a human correction resolves this field.'}
            </Alert>
            {item.response.transcriptTruncated && (
              <Alert severity="warning">
                Transcript was truncated to the demo storage limit. Verify the full conversation in
                ElevenLabs before correcting.
              </Alert>
            )}
            {item.response.transcript.map((turn, index) => (
              <Typography key={index} sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                <strong>{turn.role}:</strong> {turn.message}
              </Typography>
            ))}
            {item.status === 'COMPLETED' && (
              <>
                <TextField
                  label="Final canonical value"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  helperText="Enter the confirmed value yourself. Dates: YYYY-MM-DD; amounts: number only."
                />
                <TextField
                  label="Reason for this correction"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
                <Button
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
              </>
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
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h6">Voice clarification · ElevenLabs</Typography>
        <Alert severity="warning">
          Synthetic demo only. Calls go only to the configured test participant. Review and approve
          the exact question before starting a call. No claim approval or denial.
        </Alert>
        <TextField
          type="password"
          label="Voice reviewer key"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          helperText="Kept only in this screen's memory. Required to draft, approve, call and save a voice-evidence correction."
        />
        {issues.flatMap((issue) =>
          issue.fieldNames.map((fieldName) => (
            <Button
              key={`${issue.id}-${fieldName}`}
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
                    caseApi.clarification(claim.id, '', { issueId: issue.id, fieldName }, token),
                  'Draft prepared. Review and edit the question before approval.',
                )
              }
            >
              Call for clarification: {fieldName}
            </Button>
          )),
        )}
        {(claim.clarifications ?? []).map((item) => (
          <RequestCard key={item.id} {...props} item={item} token={token} />
        ))}
        <Button
          disabled={busy}
          onClick={() => run(() => caseApi.get(claim.id), 'Clarification status refreshed.')}
        >
          Refresh call status
        </Button>
      </Stack>
    </Paper>
  );
}
