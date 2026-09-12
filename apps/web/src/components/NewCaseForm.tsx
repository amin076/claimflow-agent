import { Alert, Box, Button, Chip, Paper, Stack, TextField, Typography } from '@mui/material';
import { useState, type FormEvent } from 'react';

type Props = { busy: boolean; onCreate: (title: string) => Promise<void> };

const DEMO_PRESETS = [
  { label: 'Motor Claim (Maya Rivera)', title: 'Synthetic motor claim — Maya Rivera' },
  { label: 'Water Damage Incident', title: 'Synthetic water-damage restoration case' },
  { label: 'Storm & Roof Repair', title: 'Synthetic storm damage invoice verification' },
  { label: 'Property Damage', title: 'Synthetic commercial property claim' },
];

export const NewCaseForm = ({ busy, onCreate }: Props) => {
  const [title, setTitle] = useState(DEMO_PRESETS[0]?.title ?? 'Synthetic motor claim');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (title.trim()) await onCreate(title.trim());
  };

  const handleSelectPreset = (presetTitle: string) => {
    setTitle(presetTitle);
  };

  return (
    <Paper component="form" onSubmit={submit} variant="outlined" sx={{ p: 2.5 }}>
      <Stack spacing={2}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 750 }}>
          New synthetic case
        </Typography>

        <Alert severity="info">
          Demo environment only. Do not enter real customer information.
        </Alert>

        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mb: 1, fontWeight: 600 }}
          >
            Quick presets for live demo:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
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
                  onClick={() => handleSelectPreset(preset.title)}
                />
              );
            })}
          </Box>
        </Box>

        <TextField
          label="Case title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 200 } }}
          required
          fullWidth
          disabled={busy}
        />

        <Button type="submit" variant="contained" disabled={busy || !title.trim()}>
          {busy ? 'Creating…' : 'Create case'}
        </Button>
      </Stack>
    </Paper>
  );
};
