import { Alert, Button, Paper, Stack, Typography } from '@mui/material';
import type { ValidationIssue } from '@claimflow/domain';

type Props = {
  issues: ValidationIssue[];
  busy: boolean;
  onRoute: (action: 'ESCALATE' | 'REQUEST_INPUT') => Promise<void>;
};

export const IssueList = ({ issues, busy, onRoute }: Props) => {
  const openIssues = issues.filter((issue) => issue.status === 'OPEN');
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h6" component="h3" sx={{ fontWeight: 750, mb: 2 }}>
        Open issues ({openIssues.length})
      </Typography>
      {openIssues.length === 0 ? (
        <Alert severity="success">No open validation issues.</Alert>
      ) : (
        <Stack spacing={1.5}>
          {openIssues.map((issue) => (
            <Alert key={issue.id} severity={issue.severity === 'BLOCKING' ? 'error' : 'warning'}>
              <Typography sx={{ fontWeight: 700 }}>{issue.type.replaceAll('_', ' ')}</Typography>
              {issue.message}
            </Alert>
          ))}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant="outlined" disabled={busy} onClick={() => onRoute('REQUEST_INPUT')}>
              Request more information
            </Button>
            <Button color="warning" disabled={busy} onClick={() => onRoute('ESCALATE')}>
              Escalate for specialist review
            </Button>
          </Stack>
        </Stack>
      )}
    </Paper>
  );
};
