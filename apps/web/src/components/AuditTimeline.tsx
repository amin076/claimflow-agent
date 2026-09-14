import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import type { AuditEvent } from '@claimflow/domain';

export const AuditTimeline = ({ events }: { events: AuditEvent[] }) => (
  <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3.5 }}>
    <Stack
      direction="row"
      sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2.25 }}
    >
      <Box>
        <Typography variant="h6" component="h3">
          Audit timeline
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
          A durable record of agent activity and human decisions.
        </Typography>
      </Box>
      <Chip label={`${events.length} events`} size="small" variant="outlined" />
    </Stack>

    <Stack spacing={0}>
      {[...events].reverse().map((event, index, reversed) => (
        <Stack key={event.id} direction="row" spacing={1.5}>
          <Box sx={{ width: 18, position: 'relative', flex: '0 0 18px' }}>
            <Box
              aria-hidden="true"
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: index === 0 ? 'primary.main' : '#9ab6bf',
                mt: 0.75,
                ml: 0.5,
                boxShadow: index === 0 ? '0 0 0 4px rgba(8,114,122,.10)' : 'none',
                position: 'relative',
                zIndex: 1,
              }}
            />
            {index < reversed.length - 1 && (
              <Box
                aria-hidden="true"
                sx={{
                  position: 'absolute',
                  left: 8.5,
                  top: 14,
                  bottom: -11,
                  width: 1,
                  bgcolor: '#dce6ea',
                }}
              />
            )}
          </Box>
          <Box sx={{ pb: 2.1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 780 }}>{event.action.replaceAll('_', ' ')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {event.summary}
            </Typography>
            <Typography variant="caption" sx={{ color: '#8a98a8', mt: 0.35, display: 'block' }}>
              {event.actorType} · {new Date(event.timestamp).toLocaleString()}
            </Typography>
          </Box>
        </Stack>
      ))}
    </Stack>
  </Paper>
);
