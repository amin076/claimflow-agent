import { Box, ButtonBase, Chip, Paper, Stack, Typography } from '@mui/material';
import type { ClaimCase } from '@claimflow/domain';
import { StatusChip } from './StatusChip.js';

type Props = {
  cases: ClaimCase[];
  selectedId?: string | undefined;
  onSelect: (claim: ClaimCase) => void;
};

export const CaseList = ({ cases, selectedId, onSelect }: Props) => {
  const reviewCount = cases.filter((claim) =>
    ['NEEDS_REVIEW', 'NEEDS_INPUT'].includes(claim.status),
  ).length;

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 3.5 }}>
      <Box sx={{ p: 2.5, pb: 2 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" component="h2">
              Cases
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Select a case to review its evidence
            </Typography>
          </Box>
          <Chip
            label={`${cases.length} total`}
            size="small"
            sx={{ bgcolor: '#edf5f6', color: '#35616b' }}
          />
        </Stack>
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Chip
            label={`Needs review ${reviewCount}`}
            size="small"
            sx={{ bgcolor: '#fff0df', color: '#a94d05' }}
          />
          <Chip
            label={`Reviewed ${Math.max(0, cases.length - reviewCount)}`}
            size="small"
            sx={{ bgcolor: '#e6f5ed', color: '#176844' }}
          />
        </Stack>
      </Box>

      {cases.length === 0 ? (
        <Typography color="text.secondary" sx={{ p: 3, pt: 1 }}>
          No cases yet. Create the first synthetic case.
        </Typography>
      ) : (
        <Stack spacing={0.75} sx={{ px: 1.25, pb: 1.25 }}>
          {cases.map((claim) => {
            const selected = selectedId === claim.id;
            const openIssues = claim.issues.filter((issue) => issue.status === 'OPEN').length;
            return (
              <ButtonBase
                key={claim.id}
                onClick={() => onSelect(claim)}
                sx={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  px: 1.75,
                  py: 1.5,
                  borderRadius: 2.5,
                  position: 'relative',
                  overflow: 'hidden',
                  bgcolor: selected ? '#edf7fb' : 'transparent',
                  border: '1px solid',
                  borderColor: selected ? '#d6eaf0' : 'transparent',
                  boxShadow: selected ? '0 8px 20px rgba(21, 83, 102, .07)' : 'none',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: 0,
                    top: 10,
                    bottom: 10,
                    width: 3,
                    borderRadius: 99,
                    bgcolor: selected ? 'primary.main' : 'transparent',
                  },
                  '&:hover': { bgcolor: selected ? '#e9f5f9' : '#f7fafb' },
                }}
              >
                <Stack spacing={0.8}>
                  <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
                    <Typography
                      sx={{
                        fontWeight: 780,
                        color: 'text.primary',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        pr: 1,
                      }}
                    >
                      {claim.title}
                    </Typography>
                    <StatusChip status={claim.status} />
                  </Stack>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {claim.reference}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {claim.documents.length} doc{claim.documents.length === 1 ? '' : 's'} ·{' '}
                    {claim.fields.length} fields · {openIssues} issue{openIssues === 1 ? '' : 's'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#8795a6' }}>
                    Updated {new Date(claim.updatedAt).toLocaleString()}
                  </Typography>
                </Stack>
              </ButtonBase>
            );
          })}
        </Stack>
      )}
    </Paper>
  );
};
