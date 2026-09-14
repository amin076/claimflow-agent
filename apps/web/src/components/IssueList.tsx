import { Alert, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import type { ValidationIssue } from '@claimflow/domain';

type Props = {
  issues: ValidationIssue[];
  busy: boolean;
  onRoute: (action: 'ESCALATE' | 'REQUEST_INPUT') => Promise<void>;
};

export const IssueList = ({ issues, busy, onRoute }: Props) => {
  const openIssues = issues.filter((issue) => issue.status === 'OPEN');

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3.5 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
      >
        <Box>
          <Typography variant="h6" component="h3">
            Review issues
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            Outstanding validation findings that still require a person.
          </Typography>
        </Box>
        <Chip
          label={`${openIssues.length} open`}
          size="small"
          color={openIssues.length ? 'warning' : 'success'}
          variant={openIssues.length ? 'filled' : 'outlined'}
        />
      </Stack>

      {openIssues.length === 0 ? (
        <Alert severity="success">No open validation issues.</Alert>
      ) : (
        <Stack spacing={1.25}>
          {openIssues.map((issue) => (
            <Alert
              key={issue.id}
              severity={issue.severity === 'BLOCKING' ? 'error' : 'warning'}
              sx={{ '& .MuiAlert-message': { width: '100%' } }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.25 }}>
                <Typography sx={{ fontWeight: 800 }}>{issue.type.replaceAll('_', ' ')}</Typography>
                {issue.severity === 'BLOCKING' && (
                  <Chip label="BLOCKING" size="small" color="error" variant="outlined" />
                )}
              </Stack>
              <Typography variant="body2">{issue.message}</Typography>
            </Alert>
          ))}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ pt: 0.5 }}>
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
