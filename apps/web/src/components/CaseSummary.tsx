import { Box, Paper, Stack, Typography } from '@mui/material';
import type { ClaimCase } from '@claimflow/domain';
import { StatusChip } from './StatusChip.js';

export const CaseSummary = ({ claim }: { claim: ClaimCase }) => {
  const openIssues = claim.issues.filter((issue) => issue.status === 'OPEN').length;
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-start' } }}
      >
        <Box>
          <Typography variant="overline" color="text.secondary">
            {claim.reference}
          </Typography>
          <Typography variant="h4" component="h2" sx={{ fontWeight: 750 }}>
            {claim.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {claim.documents.length} document{claim.documents.length === 1 ? '' : 's'} ·{' '}
            {claim.fields.length} extracted field{claim.fields.length === 1 ? '' : 's'} ·{' '}
            {openIssues} open issue{openIssues === 1 ? '' : 's'}
          </Typography>
        </Box>
        <StatusChip status={claim.status} />
      </Stack>
    </Paper>
  );
};
