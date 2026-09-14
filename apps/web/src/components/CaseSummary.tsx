import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import type { ClaimCase } from '@claimflow/domain';
import { StatusChip } from './StatusChip.js';

const Metric = ({
  value,
  label,
  tone,
}: {
  value: string | number;
  label: string;
  tone: string;
}) => (
  <Box
    sx={{
      minWidth: 110,
      px: 1.5,
      py: 1.2,
      borderRadius: 2.5,
      bgcolor: '#f8fafb',
      border: '1px solid #e8eef2',
    }}
  >
    <Typography sx={{ fontWeight: 850, fontSize: '1.1rem', color: tone, lineHeight: 1.1 }}>
      {value}
    </Typography>
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
  </Box>
);

export const CaseSummary = ({ claim }: { claim: ClaimCase }) => {
  const openIssues = claim.issues.filter((issue) => issue.status === 'OPEN').length;
  const reviewed = claim.fields.filter((field) =>
    ['ACCEPTED', 'CORRECTED'].includes(field.status),
  ).length;
  const progress = claim.fields.length ? Math.round((reviewed / claim.fields.length) * 100) : 0;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, md: 2.5 },
        borderRadius: 3.5,
        overflow: 'hidden',
        position: 'relative',
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 'auto -70px -90px auto',
          width: 190,
          height: 190,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(26, 166, 159, .10), transparent 70%)',
          pointerEvents: 'none',
        },
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2.5}
        sx={{ justifyContent: 'space-between', alignItems: { md: 'center' }, position: 'relative' }}
      >
        <Stack direction="row" spacing={2} sx={{ minWidth: 0, alignItems: 'center' }}>
          <Box
            aria-hidden="true"
            sx={{
              width: 54,
              height: 54,
              flex: '0 0 auto',
              display: 'grid',
              placeItems: 'center',
              borderRadius: 3,
              bgcolor: '#e8f5f8',
              color: '#147489',
              fontWeight: 900,
              fontSize: '.82rem',
              border: '1px solid #d6ebef',
            }}
          >
            CF
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ display: 'block', lineHeight: 1.2, mb: 0.4 }}
            >
              {claim.reference}
            </Typography>
            <Typography
              variant="h4"
              component="h2"
              sx={{ fontSize: { xs: '1.65rem', md: '2rem' } }}
            >
              {claim.title}
            </Typography>
            <Stack direction="row" spacing={0.8} sx={{ mt: 0.9, flexWrap: 'wrap', rowGap: 0.6 }}>
              <Chip
                label={`${claim.documents.length} document${claim.documents.length === 1 ? '' : 's'}`}
                size="small"
                variant="outlined"
              />
              <Chip label={`${claim.fields.length} fields`} size="small" variant="outlined" />
              <Chip
                label={`${openIssues} open issue${openIssues === 1 ? '' : 's'}`}
                size="small"
                sx={{
                  bgcolor: openIssues ? '#fff2e4' : '#e7f5ee',
                  color: openIssues ? '#ad5509' : '#176844',
                }}
              />
            </Stack>
          </Box>
        </Stack>

        <Stack spacing={1.3} sx={{ alignItems: { xs: 'flex-start', md: 'flex-end' } }}>
          <StatusChip status={claim.status} />
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <Metric value={reviewed} label="Reviewed" tone="#168657" />
            <Metric value={`${progress}%`} label="Case progress" tone="#08727a" />
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
};
