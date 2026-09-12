import {
  Alert,
  Box,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { AgentName, AgentRun } from '@claimflow/domain';

const STEP_DEFINITIONS: { name: AgentName; label: string; description: string }[] = [
  { name: 'INTAKE', label: '1. Intake', description: 'Load & register source document' },
  { name: 'QUALITY', label: '2. Quality Check', description: 'File signature & preflight check' },
  { name: 'EXTRACTION', label: '3. Extraction', description: 'Gemini multimodal extraction' },
  { name: 'VALIDATION', label: '4. Rule Validation', description: 'Deterministic & date checks' },
  { name: 'CASE_PLANNER', label: '5. Case Planner', description: 'Synthesize case plan & actions' },
  {
    name: 'REVIEW_ROUTER',
    label: '6. Review Router',
    description: 'Determine human review routing',
  },
];

const getStatusColor = (
  status: AgentRun['status'],
): 'success' | 'info' | 'error' | 'warning' | 'default' => {
  switch (status) {
    case 'SUCCEEDED':
      return 'success';
    case 'RUNNING':
      return 'info';
    case 'FAILED':
      return 'error';
    case 'SKIPPED':
      return 'warning';
    default:
      return 'default';
  }
};

export function AgentRunList({ runs }: { runs: AgentRun[] }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  if (!runs.length) return null;

  const runMap = new Map<AgentName, AgentRun>(runs.map((r) => [r.agent, r]));
  const isProcessing = runs.some((r) => r.status === 'RUNNING' || r.status === 'QUEUED');
  const totalTokens = runs.reduce((acc, r) => acc + (r.totalTokens ?? 0), 0);
  const totalDurationMs = runs.reduce((acc, r) => acc + (r.durationMs ?? 0), 0);
  const activeModel = runs.find((r) => r.model)?.model;

  // Active step calculation for MUI Stepper
  let activeStep = STEP_DEFINITIONS.length;
  for (let i = 0; i < STEP_DEFINITIONS.length; i++) {
    const stepDef = STEP_DEFINITIONS[i];
    if (!stepDef) continue;
    const run = runMap.get(stepDef.name);
    if (!run || run.status === 'QUEUED' || run.status === 'RUNNING') {
      activeStep = i;
      break;
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={2.5}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' } }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 750 }}>
              AI Agent Execution Stream
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ADK multi-agent workflow runtime status
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {activeModel && (
              <Chip
                label={`Model: ${activeModel}`}
                size="small"
                variant="outlined"
                color="primary"
              />
            )}
            {totalTokens > 0 && (
              <Chip
                label={`${totalTokens.toLocaleString()} tokens`}
                size="small"
                variant="outlined"
              />
            )}
            {totalDurationMs > 0 && (
              <Chip
                label={`${(totalDurationMs / 1000).toFixed(2)}s`}
                size="small"
                variant="outlined"
              />
            )}
          </Stack>
        </Stack>

        {isProcessing && <LinearProgress color="info" sx={{ borderRadius: 1 }} />}

        {/* Stepper View */}
        <Stepper
          activeStep={activeStep}
          orientation={isMobile ? 'vertical' : 'horizontal'}
          alternativeLabel={!isMobile}
          sx={{ py: 1 }}
        >
          {STEP_DEFINITIONS.map((def) => {
            const run = runMap.get(def.name);
            const status = run?.status;
            const isFailed = status === 'FAILED';
            const isSkipped = status === 'SKIPPED';
            const isRunning = status === 'RUNNING';

            return (
              <Step key={def.name} completed={status === 'SUCCEEDED'}>
                <StepLabel
                  error={isFailed}
                  optional={
                    run ? (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block' }}
                      >
                        {isRunning
                          ? 'Executing…'
                          : run.durationMs !== undefined
                            ? `${run.durationMs}ms`
                            : isSkipped
                              ? 'Skipped'
                              : ''}
                      </Typography>
                    ) : undefined
                  }
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                    {def.label}
                  </Typography>
                </StepLabel>
              </Step>
            );
          })}
        </Stepper>

        {/* Detailed Run Items */}
        <Stack spacing={1.5}>
          {runs.map((run) => {
            const def = STEP_DEFINITIONS.find((d) => d.name === run.agent);
            return (
              <Paper
                key={run.id}
                variant="outlined"
                sx={{
                  p: 1.5,
                  bgcolor: run.status === 'RUNNING' ? 'action.hover' : 'background.paper',
                  borderColor: run.status === 'FAILED' ? 'error.main' : 'divider',
                }}
              >
                <Stack spacing={0.5}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {def?.label ?? run.agent}
                      </Typography>
                      <Chip
                        size="small"
                        label={run.status}
                        color={getStatusColor(run.status)}
                        variant={run.status === 'SUCCEEDED' ? 'filled' : 'outlined'}
                      />
                    </Stack>

                    <Typography variant="caption" color="text.secondary">
                      {run.durationMs !== undefined ? `${run.durationMs} ms` : ''}
                      {run.totalTokens !== undefined ? ` · ${run.totalTokens} tokens` : ''}
                    </Typography>
                  </Stack>

                  {run.model && (
                    <Typography variant="caption" color="text.secondary">
                      Engine: {run.model} {run.modelVersion ? `(${run.modelVersion})` : ''}
                    </Typography>
                  )}

                  {run.errorSummary && (
                    <Alert severity="error" sx={{ mt: 1 }}>
                      {run.errorSummary}
                    </Alert>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      </Stack>
    </Paper>
  );
}
