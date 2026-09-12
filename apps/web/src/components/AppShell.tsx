import { Box, Chip, Container, Stack, Typography } from '@mui/material';
import type { PropsWithChildren } from 'react';

export const AppShell = ({ children }: PropsWithChildren) => (
  <Box component="main" sx={{ minHeight: '100vh', pb: 8 }}>
    <Box component="header" sx={{ bgcolor: '#073b4c', color: 'common.white', py: 4, mb: 4 }}>
      <Container maxWidth="xl">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
        >
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
              ClaimFlow AI
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,.78)', mt: 0.5 }}>
              Evidence-first case preparation with human review
            </Typography>
          </Box>
          <Chip
            label="LOCAL · MOCK AI"
            sx={{ bgcolor: '#d8f3dc', color: '#1b4332', fontWeight: 800, alignSelf: 'start' }}
          />
        </Stack>
      </Container>
    </Box>
    <Container maxWidth="xl">{children}</Container>
  </Box>
);
