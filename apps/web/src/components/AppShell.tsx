import { Box, Chip, Container, Stack, Typography } from '@mui/material';
import type { PropsWithChildren } from 'react';

const navItems = [
  { short: 'H', label: 'Home' },
  { short: 'R', label: 'Human Review', active: true },
  { short: 'A', label: 'AI Runs' },
  { short: 'D', label: 'Documents' },
];

const Brand = ({ compact = false }: { compact?: boolean }) => (
  <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
    <Box
      aria-hidden="true"
      sx={{
        width: compact ? 30 : 38,
        height: compact ? 30 : 38,
        borderRadius: '12px 5px 12px 5px',
        transform: 'rotate(-8deg)',
        background: 'linear-gradient(145deg, #36d2c5 0%, #16a8ad 100%)',
        boxShadow: '0 8px 22px rgba(24, 199, 191, .28)',
        position: 'relative',
        flex: '0 0 auto',
        '&::after': {
          content: '""',
          position: 'absolute',
          width: '58%',
          height: 2,
          bgcolor: 'rgba(255,255,255,.78)',
          left: '20%',
          top: '50%',
          borderRadius: 99,
          transform: 'rotate(-18deg)',
        },
      }}
    />
    <Box>
      <Typography
        sx={{
          color: compact ? 'text.primary' : 'common.white',
          fontWeight: 850,
          fontSize: compact ? '1.05rem' : '1.35rem',
          letterSpacing: '-0.04em',
          lineHeight: 1.05,
        }}
      >
        ClaimFlow
      </Typography>
      {!compact && (
        <Typography sx={{ color: 'rgba(255,255,255,.65)', fontSize: '.74rem', mt: 0.35 }}>
          Evidence first. Better outcomes.
        </Typography>
      )}
    </Box>
  </Stack>
);

export const AppShell = ({ children }: PropsWithChildren) => (
  <Box sx={{ minHeight: '100vh', display: 'flex' }}>
    <Box
      component="aside"
      sx={{
        display: { xs: 'none', lg: 'flex' },
        flexDirection: 'column',
        width: 220,
        flex: '0 0 220px',
        minHeight: '100vh',
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        zIndex: 5,
        color: 'common.white',
        px: 2,
        py: 3,
        background:
          'radial-gradient(circle at 15% 0%, rgba(35,211,198,.16), transparent 30%), linear-gradient(180deg, #06485a 0%, #063847 55%, #052f3c 100%)',
        boxShadow: '8px 0 28px rgba(14, 50, 66, .08)',
      }}
    >
      <Box sx={{ px: 1, mb: 4 }}>
        <Brand />
      </Box>

      <Stack spacing={0.75}>
        {navItems.map((item) => (
          <Stack
            key={item.label}
            direction="row"
            spacing={1.25}
            sx={{
              alignItems: 'center',
              minHeight: 44,
              px: 1.25,
              borderRadius: 2.5,
              color: item.active ? '#ffffff' : 'rgba(255,255,255,.72)',
              bgcolor: item.active ? 'rgba(49, 203, 194, .15)' : 'transparent',
              border: item.active ? '1px solid rgba(77, 222, 211, .18)' : '1px solid transparent',
            }}
          >
            <Box
              sx={{
                width: 27,
                height: 27,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 2,
                bgcolor: item.active ? 'rgba(61, 213, 203, .18)' : 'rgba(255,255,255,.07)',
                color: item.active ? '#61e0d6' : 'rgba(255,255,255,.78)',
                fontSize: '.72rem',
                fontWeight: 850,
              }}
            >
              {item.short}
            </Box>
            <Typography sx={{ fontSize: '.9rem', fontWeight: item.active ? 760 : 600 }}>
              {item.label}
            </Typography>
          </Stack>
        ))}
      </Stack>

      <Box sx={{ flex: 1 }} />
      <Box
        sx={{
          p: 2,
          borderRadius: 3,
          border: '1px solid rgba(91, 224, 214, .14)',
          background: 'linear-gradient(145deg, rgba(38, 184, 180, .13), rgba(255,255,255,.035))',
        }}
      >
        <Typography sx={{ color: '#70e2d8', fontSize: '.72rem', fontWeight: 800 }}>
          EVIDENCE-FIRST AI
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,.88)', fontSize: '.82rem', mt: 0.5 }}>
          Humans stay in control of consequential decisions.
        </Typography>
      </Box>
    </Box>

    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 4,
          minHeight: 68,
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'rgba(255,255,255,.90)',
          backdropFilter: 'blur(18px)',
        }}
      >
        <Container maxWidth={false} sx={{ px: { xs: 2, sm: 3, xl: 4 } }}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: { xs: 'block', lg: 'none' } }}>
              <Brand compact />
            </Box>
            <Typography
              sx={{
                display: { xs: 'none', lg: 'block' },
                color: 'text.secondary',
                fontSize: '.83rem',
                fontWeight: 650,
              }}
            >
              Human Review / Evidence Workspace
            </Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Chip
                label="LIVE DEMO"
                size="small"
                sx={{ bgcolor: '#e8f7f3', color: '#147052', border: '1px solid #ccecdf' }}
              />
              <Chip
                label="SYNTHETIC DATA"
                size="small"
                variant="outlined"
                sx={{ color: 'text.secondary', borderColor: '#d7e2e8' }}
              />
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Box component="main" sx={{ pb: 8 }}>
        <Container maxWidth={false} sx={{ px: { xs: 2, sm: 3, xl: 4 }, pt: { xs: 3, md: 4 } }}>
          {children}
        </Container>
      </Box>
    </Box>
  </Box>
);
