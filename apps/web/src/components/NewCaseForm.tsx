import { Alert, Box, Button, Chip, Paper, Stack, TextField, Typography } from '@mui/material';
import { useState, type FormEvent } from 'react';

type Props = { busy: boolean; onCreate: (title: string) => Promise<void> };

const DEMO_PRESETS = [
  { label: 'Motor Claim', title: 'Synthetic motor claim — Maya Rivera' },
  { label: 'Water Damage', title: 'Synthetic water-damage restoration case' },
  { label: 'Storm & Roof', title: 'Synthetic storm damage invoice verification' },
  { label: 'Property Damage', title: 'Synthetic commercial property claim' },
];

export const NewCaseForm = ({ busy, onCreate }: Props) => {
  const [title, setTitle] = useState(DEMO_PRESETS[0]?.title ?? 'Synthetic motor claim');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (title.trim()) await onCreate(title.trim());
  };

  return (
    <Paper
      component="form"
      onSubmit={submit}
      variant="outlined"
      sx={{ p: 2.5, borderRadius: 3.5, overflow: 'hidden', position: 'relative' }}
    >
      <Box
        aria-hidden="true"
        sx={{
          position: 'absolute',
          width: 120,
          height: 120,
          right: -45,
          top: -55,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(33, 184, 175, .13), transparent 70%)',
        }}
      />
      <Stack spacing={1.75} sx={{ position: 'relative' }}>
        <Box>
          <Typography variant="h6" component="h2">
            New synthetic case
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            Start from a demo preset or name your own synthetic case.
          </Typography>
        </Box>

        <Alert severity="info" sx={{ py: 0.25 }}>
          Synthetic data only — do not enter real customer information.
        </Alert>

        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mb: 0.85, fontWeight: 800 }}
          >
            QUICK PRESETS
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.7 }}>
            {DEMO_PRESETS.map((preset) => {
              const isSelected = title === preset.title;
              return (
                <Chip
                  key={preset.label}
                  label={preset.label}
                  size="small"
                  clickable
                  disabled={busy}
                  color={isSelected ? 'primary' : 'default'}
                  variant={isSelected ? 'filled' : 'outlined'}
                  onClick={() => setTitle(preset.title)}
                />
              );
            })}
          </Box>
        </Box>

        <TextField
          label="Case title"
          size="small"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 200 } }}
          required
          fullWidth
          disabled={busy}
        />

        <Button type="submit" variant="contained" disabled={busy || !title.trim()} fullWidth>
          {busy ? 'Creating…' : 'Create synthetic case'}
        </Button>
      </Stack>
    </Paper>
  );
};
