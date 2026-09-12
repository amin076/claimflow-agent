import {
  Box,
  Button,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { ClaimFieldName, ExtractedField } from '@claimflow/domain';
import { useState } from 'react';

type Props = {
  fields: ExtractedField[];
  busy: boolean;
  onReview: (
    action: 'ACCEPT' | 'CORRECT' | 'REJECT',
    fieldName: ClaimFieldName,
    correctedValue?: string,
  ) => Promise<void>;
};

export const ExtractedFieldList = ({ fields, busy, onReview }: Props) => {
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h6" component="h3" sx={{ fontWeight: 750, mb: 2 }}>
        Extracted fields
      </Typography>
      {fields.length === 0 ? (
        <Typography color="text.secondary">
          Add a synthetic document and process this case to generate fields.
        </Typography>
      ) : (
        <Stack spacing={2.5} divider={<Divider flexItem />}>
          {fields.map((field) => {
            const percent = Math.round(field.confidence * 100);
            const correction = corrections[field.name] ?? field.displayValue;
            return (
              <Box key={field.id}>
                <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
                  <Typography sx={{ fontWeight: 750 }}>{field.name}</Typography>
                  <Typography color={field.requiresReview ? 'warning.main' : 'success.main'}>
                    {percent}% confidence
                  </Typography>
                </Stack>
                <Typography variant="h6" sx={{ mt: 0.5 }}>
                  {field.displayValue}
                </Typography>
                <LinearProgress
                  aria-label={`${field.name} confidence ${percent}%`}
                  variant="determinate"
                  value={percent}
                  color={field.requiresReview ? 'warning' : 'success'}
                  sx={{ my: 1.25, height: 6, borderRadius: 3 }}
                />
                <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 800 }}>
                    SOURCE EVIDENCE
                  </Typography>
                  <Typography variant="body2">
                    {field.evidence[0]?.excerpt ?? 'Evidence location recorded without an excerpt.'}
                  </Typography>
                </Box>
                {field.uncertaintyReasons.map((reason) => (
                  <Typography key={reason} variant="body2" color="warning.dark" sx={{ mt: 1 }}>
                    {reason}
                  </Typography>
                ))}
                {field.requiresReview && (
                  <Stack spacing={1.5} sx={{ mt: 2 }}>
                    <TextField
                      size="small"
                      label="Corrected value"
                      value={correction}
                      onChange={(event) =>
                        setCorrections((current) => ({
                          ...current,
                          [field.name]: event.target.value,
                        }))
                      }
                      fullWidth
                    />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Button
                        variant="contained"
                        color="success"
                        disabled={busy}
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
