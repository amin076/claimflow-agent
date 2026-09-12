import { Box, Button, Chip, Container, Paper, Stack, Typography } from '@mui/material';

export const App = () => (
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
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: 'center' }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6">Phase 1 foundation is running</Typography>
              <Typography color="text.secondary">
                React frontend and Fastify API are ready for the first synthetic claim workflow.
              </Typography>
            </Box>
            <Button variant="contained" size="large">
              Create demo case
            </Button>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  </Box>
);
