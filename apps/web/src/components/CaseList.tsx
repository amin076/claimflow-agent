import { Box, ButtonBase, Divider, Paper, Stack, Typography } from '@mui/material';
import type { ClaimCase } from '@claimflow/domain';
import { StatusChip } from './StatusChip.js';

type Props = {
  cases: ClaimCase[];
  selectedId?: string | undefined;
  onSelect: (claim: ClaimCase) => void;
};

export const CaseList = ({ cases, selectedId, onSelect }: Props) => (
  <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
    <Box sx={{ p: 2.5 }}>
      <Typography variant="h6" component="h2" sx={{ fontWeight: 750 }}>
        Cases
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Cases in this ClaimFlow workspace
      </Typography>
    </Box>
    <Divider />
    {cases.length === 0 ? (
      <Typography color="text.secondary" sx={{ p: 3 }}>
        No cases yet. Create the first synthetic case.
      </Typography>
    ) : (
      <Stack divider={<Divider flexItem />}>
        {cases.map((claim) => (
          <ButtonBase
            key={claim.id}
            onClick={() => onSelect(claim)}
            sx={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              p: 2,
              bgcolor: selectedId === claim.id ? 'rgba(12,111,115,.09)' : 'transparent',
              borderLeft: 4,
              borderColor: selectedId === claim.id ? 'primary.main' : 'transparent',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
                <Typography variant="overline" color="text.secondary">
                  {claim.reference}
                </Typography>
                <StatusChip status={claim.status} />
              </Stack>
              <Typography sx={{ fontWeight: 700 }}>{claim.title}</Typography>
              <Typography variant="caption" color="text.secondary">
                Updated {new Date(claim.updatedAt).toLocaleString()}
              </Typography>
            </Stack>
          </ButtonBase>
        ))}
      </Stack>
    )}
  </Paper>
);
