import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { ClaimCaseSchema, type ClaimCase } from '@claimflow/domain';

export const App = () => {
  const [claim, setClaim] = useState<ClaimCase>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const loadDemoCase = async () => {
    setLoading(true);
    setError(undefined);

    try {
      const response = await fetch('/api/cases/demo');
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      setClaim(ClaimCaseSchema.parse(await response.json()));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the demo case.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="main" sx={{ minHeight: '100vh', py: { xs: 4, md: 8 } }}>
      <Container maxWidth="md">
        <Stack spacing={3}>
          <Chip label="Evidence-first claim intake" color="primary" sx={{ alignSelf: 'start' }} />
          <Typography variant="h2" sx={{ fontWeight: 750 }}>
            Turn messy documents into review-ready cases.
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 720 }}>
            ClaimFlow AI extracts structured facts, preserves their evidence, flags uncertainty, and
            keeps a human in control.
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{ alignItems: 'center' }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6">Synthetic claim workflow</Typography>
                <Typography color="text.secondary">
                  Load a typed, evidence-linked case from the Fastify API. No cloud or AI required.
                </Typography>
              </Box>
              <Button variant="contained" size="large" onClick={loadDemoCase} disabled={loading}>
                {loading ? <CircularProgress color="inherit" size={24} /> : 'Create demo case'}
              </Button>
            </Stack>
          </Paper>

          {claim && (
            <Paper variant="outlined" sx={{ p: 3 }}>
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  sx={{ justifyContent: 'space-between' }}
                >
                  <Box>
                    <Typography variant="overline" color="text.secondary">
                      {claim.reference}
                    </Typography>
                    <Typography variant="h5">{claim.title}</Typography>
                  </Box>
                  <Chip label={claim.status.replaceAll('_', ' ')} color="warning" />
                </Stack>
                <Divider />
                <Typography variant="h6">Extracted fields</Typography>
                {claim.fields.map((field) => (
                  <Box key={field.id}>
                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
                      <Typography sx={{ fontWeight: 650 }}>{field.name}</Typography>
                      <Typography color={field.requiresReview ? 'warning.main' : 'success.main'}>
                        {Math.round(field.confidence * 100)}%
                      </Typography>
                    </Stack>
                    <Typography>{field.displayValue}</Typography>
                    <LinearProgress
                      variant="determinate"
                      value={field.confidence * 100}
                      color={field.requiresReview ? 'warning' : 'success'}
                      sx={{ mt: 1 }}
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Evidence: {field.evidence[0]?.excerpt}
                    </Typography>
                  </Box>
                ))}
                <Divider />
                <Typography variant="h6">Open issues ({claim.issues.length})</Typography>
                {claim.issues.map((issue) => (
                  <Alert
                    key={issue.id}
                    severity={issue.severity === 'BLOCKING' ? 'error' : 'warning'}
                  >
                    {issue.message}
                  </Alert>
                ))}
              </Stack>
            </Paper>
          )}
        </Stack>
      </Container>
    </Box>
  );
};
