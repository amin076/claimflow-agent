import { Alert, Chip, Paper, Stack, Typography } from '@mui/material';
import type { AgentRun } from '@claimflow/domain';
export function AgentRunList({ runs }: { runs: AgentRun[] }) {
  if (!runs.length) return null;
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h6">Workflow steps</Typography>
        {runs.map((run) => (
          <Stack key={run.id} spacing={0.5}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography sx={{ fontWeight: 700 }}>{run.agent.replaceAll('_', ' ')}</Typography>
              <Chip size="small" label={run.status} />
            </Stack>
            {run.model && (
              <Typography variant="body2">
                Model: {run.model}
                {run.modelVersion ? ` (${run.modelVersion})` : ''}
              </Typography>
            )}
            <Typography variant="caption">
              {run.durationMs !== undefined ? `${run.durationMs} ms` : ''}
              {run.totalTokens !== undefined ? ` · ${run.totalTokens} total tokens` : ''}
            </Typography>
            {run.errorSummary && <Alert severity="error">{run.errorSummary}</Alert>}
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}
