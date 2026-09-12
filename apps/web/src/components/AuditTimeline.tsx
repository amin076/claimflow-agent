import { Box, Divider, Paper, Stack, Typography } from '@mui/material';
import type { AuditEvent } from '@claimflow/domain';

export const AuditTimeline = ({ events }: { events: AuditEvent[] }) => (
  <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
    <Typography variant="h6" component="h3" sx={{ fontWeight: 750, mb: 2 }}>
      Audit timeline
    </Typography>
    <Stack spacing={2} divider={<Divider flexItem />}>
      {[...events].reverse().map((event) => (
        <Stack key={event.id} direction="row" spacing={2}>
          <Box
            aria-hidden="true"
            sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'primary.main', mt: 0.75 }}
          />
          <Box>
            <Typography sx={{ fontWeight: 750 }}>{event.action.replaceAll('_', ' ')}</Typography>
            <Typography variant="body2">{event.summary}</Typography>
            <Typography variant="caption" color="text.secondary">
              {event.actorType} · {new Date(event.timestamp).toLocaleString()}
            </Typography>
          </Box>
        </Stack>
      ))}
    </Stack>
  </Paper>
);
