import { Chip, type ChipProps } from '@mui/material';
import type { CaseStatus } from '@claimflow/domain';

const colors: Record<CaseStatus, ChipProps['color']> = {
  DRAFT: 'default',
  PROCESSING: 'info',
  NEEDS_INPUT: 'error',
  NEEDS_REVIEW: 'warning',
  READY: 'success',
  FAILED: 'error',
};

export const StatusChip = ({ status }: { status: CaseStatus }) => (
  <Chip label={status.replaceAll('_', ' ')} color={colors[status]} size="small" />
);
