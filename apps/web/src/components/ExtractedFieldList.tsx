import {
  Box,
  Button,
  Chip,
  InputAdornment,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { ClaimFieldName, ExtractedField } from '@claimflow/domain';
import { useMemo, useState } from 'react';

type Props = {
  caseId: string;
  fields: ExtractedField[];
  busy: boolean;
  onReview: (
    action: 'ACCEPT' | 'CORRECT' | 'REJECT',
    fieldName: ClaimFieldName,
    correctedValue?: string,
  ) => Promise<void>;
};

type FilterCategory = 'ALL' | 'NEEDS_REVIEW' | 'ACCEPTED' | 'PROPOSED';

const hasConflict = (field: ExtractedField) =>
  field.uncertaintyReasons.some((reason) => reason.startsWith('Conflicting source values:'));

export const ExtractedFieldList = ({ caseId, fields, busy, onReview }: Props) => {
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('ALL');

  const needsReviewCount = useMemo(
    () => fields.filter((field) => field.requiresReview || field.confidence < 0.8).length,
    [fields],
  );

  const filteredFields = useMemo(() => {
    return fields.filter((field) => {
      if (activeFilter === 'NEEDS_REVIEW' && !(field.requiresReview || field.confidence < 0.8)) {
        return false;
      }
      if (activeFilter === 'ACCEPTED' && field.status !== 'ACCEPTED') return false;
      if (activeFilter === 'PROPOSED' && field.status !== 'PROPOSED') return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = field.name.toLowerCase().includes(query);
        const matchesValue = field.displayValue.toLowerCase().includes(query);
        const matchesEvidence = field.evidence.some((evidence) =>
          evidence.excerpt?.toLowerCase().includes(query),
        );
        return matchesName || matchesValue || matchesEvidence;
      }

      return true;
    });
  }, [fields, activeFilter, searchQuery]);

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3.5 }}>
      <Stack spacing={2.25} sx={{ mb: 2.25 }}>
        <Box>
          <Typography variant="h6" component="h3">
            Extracted fields
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            Verify model proposals against their linked source evidence before taking action.
          </Typography>
        </Box>

        {fields.length > 0 && (
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', md: 'center' } }}
          >
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
              <Chip
                label={`All ${fields.length}`}
                size="small"
                clickable
                color={activeFilter === 'ALL' ? 'primary' : 'default'}
                variant={activeFilter === 'ALL' ? 'filled' : 'outlined'}
                onClick={() => setActiveFilter('ALL')}
              />
              <Chip
                label={`Needs review ${needsReviewCount}`}
                size="small"
                clickable
                color={activeFilter === 'NEEDS_REVIEW' ? 'warning' : 'default'}
                variant={activeFilter === 'NEEDS_REVIEW' ? 'filled' : 'outlined'}
                onClick={() => setActiveFilter('NEEDS_REVIEW')}
              />
              <Chip
                label="Accepted"
                size="small"
                clickable
                color={activeFilter === 'ACCEPTED' ? 'success' : 'default'}
                variant={activeFilter === 'ACCEPTED' ? 'filled' : 'outlined'}
                onClick={() => setActiveFilter('ACCEPTED')}
              />
              <Chip
                label="Proposed"
                size="small"
                clickable
                color={activeFilter === 'PROPOSED' ? 'info' : 'default'}
                variant={activeFilter === 'PROPOSED' ? 'filled' : 'outlined'}
                onClick={() => setActiveFilter('PROPOSED')}
              />
            </Box>

            <TextField
              size="small"
              placeholder="Search fields or evidence"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              sx={{ minWidth: { xs: '100%', md: 250 } }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Box component="span" sx={{ color: 'text.secondary', fontWeight: 800 }}>
                        ⌕
                      </Box>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Stack>
        )}
      </Stack>

      {fields.length === 0 ? (
        <Typography color="text.secondary">
          Add a synthetic document and process this case to generate fields.
        </Typography>
      ) : filteredFields.length === 0 ? (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography color="text.secondary" sx={{ mb: 1 }}>
            No extracted fields match your filter or search terms.
          </Typography>
          <Button
            size="small"
            onClick={() => {
              setActiveFilter('ALL');
              setSearchQuery('');
            }}
          >
            Reset filter and search
          </Button>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {filteredFields.map((field) => {
            const percent = Math.round(field.confidence * 100);
            const historicalConflict = hasConflict(field);
            const conflicted = historicalConflict && field.status !== 'CORRECTED';
            const resolvedConflict = historicalConflict && field.status === 'CORRECTED';
            const correction = corrections[field.id] ?? (conflicted ? '' : field.displayValue);
            const surface = resolvedConflict ? '#fbfefd' : conflicted ? '#fffdfb' : '#ffffff';
            const border = resolvedConflict ? '#d8ebe2' : conflicted ? '#f1dfcf' : '#e6edf1';

            return (
              <Box
                key={field.id}
                sx={{
                  p: { xs: 1.75, md: 2 },
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: border,
                  bgcolor: surface,
                  boxShadow: '0 6px 18px rgba(25, 54, 72, .035)',
                }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  sx={{
                    justifyContent: 'space-between',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                  >
                    <Typography sx={{ fontWeight: 820 }}>{field.name}</Typography>
                    {conflicted && <Chip label="Conflict detected" size="small" color="error" />}
                    {resolvedConflict && (
                      <Chip label="Resolved by human" size="small" color="success" />
                    )}
                    {!historicalConflict && field.status === 'ACCEPTED' && (
                      <Chip label="Reviewed" size="small" color="success" variant="outlined" />
                    )}
                  </Stack>
                  <Box sx={{ minWidth: { sm: 150 }, textAlign: { sm: 'right' } }}>
                    <Typography
                      sx={{
                        fontWeight: 820,
                        color: field.requiresReview ? 'warning.dark' : 'success.dark',
                      }}
                    >
                      {percent}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Model estimate
                    </Typography>
                  </Box>
                </Stack>

                <Typography variant="h6" sx={{ mt: 0.6, fontSize: '1.22rem' }}>
                  {field.displayValue}
                </Typography>
                <LinearProgress
                  aria-label={`${field.name} confidence ${percent}%`}
                  variant="determinate"
                  value={percent}
                  color={field.requiresReview ? 'warning' : 'success'}
                  sx={{ my: 1.3 }}
                />

                {field.evidence.length > 0 && (
                  <Box sx={{ mt: 1.35 }}>
                    <Typography variant="caption" sx={{ fontWeight: 820, color: 'text.secondary' }}>
                      SOURCE EVIDENCE
                    </Typography>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: 1,
                        mt: 0.8,
                      }}
                    >
                      {field.evidence.map((item) => (
                        <Box
                          key={item.id}
                          sx={{
                            p: 1.4,
                            borderRadius: 2.25,
                            bgcolor: item.clarificationResponseId ? '#f3f8ff' : '#f7fafb',
                            border: '1px solid',
                            borderColor: item.clarificationResponseId ? '#d8e8f8' : '#e4ecef',
                          }}
                        >
                          <Typography variant="body2">
                            {item.excerpt ?? 'No excerpt supplied.'}
                          </Typography>
                          <Button
                            size="small"
                            component="a"
                            sx={{ px: 0, minHeight: 30, mt: 0.35 }}
                            href={
                              item.clarificationResponseId
                                ? `#${item.clarificationResponseId}`
                                : `/api/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(item.documentId ?? '')}/content`
                            }
                          >
                            {item.clarificationResponseId
                              ? 'Clarification transcript'
                              : `Source · page ${item.page ?? 1}`}
                          </Button>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}

                {field.uncertaintyReasons
                  .filter(
                    (reason) =>
                      !(resolvedConflict && reason.startsWith('Conflicting source values:')),
                  )
                  .map((reason) => (
                    <Typography key={reason} variant="body2" color="warning.dark" sx={{ mt: 1 }}>
                      {reason}
                    </Typography>
                  ))}

                {resolvedConflict && (
                  <Box
                    sx={{
                      mt: 1.25,
                      px: 1.35,
                      py: 1,
                      borderRadius: 2,
                      bgcolor: '#edf8f2',
                      border: '1px solid #d9ede3',
                    }}
                  >
                    <Typography variant="body2" color="success.dark" sx={{ fontWeight: 720 }}>
                      Original source conflict retained in evidence history. The canonical value was
                      resolved by human review.
                    </Typography>
                  </Box>
                )}

                {conflicted && (
                  <Typography variant="body2" color="error.main" sx={{ mt: 1.15, fontWeight: 720 }}>
                    Review the cited evidence and save one canonical value. Accepting the combined
                    AI value does not resolve this conflict.
                  </Typography>
                )}

                {(field.requiresReview ||
                  field.status === 'PROPOSED' ||
                  field.status === 'REJECTED') && (
                  <Stack spacing={1.3} sx={{ mt: 1.6 }}>
                    <TextField
                      size="small"
                      label={conflicted ? 'Resolved canonical value' : 'Corrected value'}
                      placeholder={
                        conflicted
                          ? 'Enter one supported value after reviewing the evidence'
                          : undefined
                      }
                      value={correction}
                      onChange={(event) =>
                        setCorrections((current) => ({
                          ...current,
                          [field.id]: event.target.value,
                        }))
                      }
                      fullWidth
                    />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Button
                        variant="contained"
                        color="success"
                        disabled={busy || conflicted}
                        onClick={() => onReview('ACCEPT', field.name)}
                      >
                        Accept value
                      </Button>
                      <Button
                        variant="contained"
                        disabled={busy || !correction.trim()}
                        onClick={() => onReview('CORRECT', field.name, correction)}
                      >
                        Save correction
                      </Button>
                      <Button
                        color="error"
                        disabled={busy}
                        onClick={() => onReview('REJECT', field.name)}
                      >
                        Reject field
                      </Button>
                    </Stack>
                  </Stack>
                )}
              </Box>
            );
          })}
        </Stack>
      )}
    </Paper>
  );
};
