import { Alert, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useState, type FormEvent } from 'react';

type Props = { busy: boolean; onCreate: (title: string) => Promise<void> };

export const NewCaseForm = ({ busy, onCreate }: Props) => {
  const [title, setTitle] = useState('Synthetic water-damage case');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (title.trim()) await onCreate(title.trim());
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
        <TextField
          label="Case title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 200 } }}
          required
          fullWidth
        />
        <Button type="submit" variant="contained" disabled={busy || !title.trim()}>
          Create case
        </Button>
      </Stack>
    </Paper>
  );
};
