/* global process, console, fetch, AbortSignal */
// Read-only release verification. Never access secret versions or print raw gcloud output.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const expected = {
  ELEVENLABS_API_KEY: 'claimflow-elevenlabs-api-key',
  ELEVENLABS_AGENT_ID: 'claimflow-elevenlabs-agent-id',
  ELEVENLABS_PHONE_NUMBER_ID: 'claimflow-elevenlabs-phone-id',
  ELEVENLABS_WEBHOOK_SECRET: 'claimflow-elevenlabs-webhook-secret',
  CLARIFICATION_REVIEW_TOKEN: 'claimflow-clarification-review-token',
  CLARIFICATION_TEST_PHONE: 'claimflow-clarification-test-phone',
};
export function safeMetadata(service) {
  const entries = service.spec?.template?.spec?.containers?.[0]?.env ?? [];
  const refs = {};
  for (const [name, secretName] of Object.entries(expected)) {
    const entry = entries.find((entry) => entry.name === name);
    const ref = entry?.valueFrom?.secretKeyRef;
    if (!ref || entry.value !== undefined || ref.name !== secretName || !/^\d+$/.test(ref.key))
      throw new Error(`VOICE_SECRET_REFERENCE_INVALID:${name}`);
    refs[name] = { secret: secretName, version: ref.key };
  }
  const revision = service.status?.latestReadyRevisionName;
  if (typeof revision !== 'string' || !/^claimflow-api-[a-z0-9-]+$/.test(revision))
    throw new Error('REVISION_NOT_READY');
  const traffic = service.status?.traffic ?? [];
  if (!traffic.some((target) => target.revisionName === revision && target.percent === 100))
    throw new Error('REVISION_NOT_SERVING_ALL_TRAFFIC');
  if (
    service.spec?.template?.spec?.serviceAccountName !==
    'claimflow-api-runtime@claimflow-ai-agents.iam.gserviceaccount.com'
  )
    throw new Error('RUNTIME_IDENTITY_CHANGED');
  return { revision, refs };
}
function gcloud(args) {
  const result = spawnSync('gcloud', args, {
    encoding: 'utf8',
    timeout: 60000,
    maxBuffer: 2_000_000,
  });
  if (result.status !== 0) throw new Error('CLOUD_METADATA_UNAVAILABLE');
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error('CLOUD_METADATA_INVALID');
  }
}
async function run() {
  const [stage, snapshot] = process.argv.slice(2);
  if (!['before', 'after'].includes(stage) || !snapshot)
    throw new Error('INVALID_VERIFICATION_ARGUMENTS');
  const metadata = safeMetadata(
    gcloud([
      'run',
      'services',
      'describe',
      'claimflow-api',
      '--project=claimflow-ai-agents',
      '--region=australia-southeast1',
      '--format=json',
    ]),
  );
  if (stage === 'before') {
    writeFileSync(snapshot, JSON.stringify(metadata), { mode: 0o600 });
    // The old handler swallowed provider errors. Request latency is only supporting evidence.
    try {
      const rows = gcloud([
        'logging',
        'read',
        'resource.type="cloud_run_revision" AND resource.labels.service_name="claimflow-api" AND httpRequest.status=502 AND httpRequest.requestUrl=~"/api/cases/[^/]+/clarifications$"',
        '--project=claimflow-ai-agents',
        '--freshness=2d',
        '--limit=10',
        '--format=json(timestamp,httpRequest.status,httpRequest.latency,resource.labels.revision_name)',
      ]);
      console.log(
        JSON.stringify({
          event: 'PREVIOUS_DRAFT_502_REQUESTS',
          requests: rows.map((row) => ({
            timestamp: /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(row.timestamp)
              ? row.timestamp
              : 'UNAVAILABLE',
            latency: /^\d+(\.\d+)?s$/.test(row.httpRequest?.latency)
              ? row.httpRequest.latency
              : 'UNAVAILABLE',
            status: 502,
          })),
        }),
      );
    } catch {
      console.log(JSON.stringify({ event: 'PREVIOUS_DRAFT_LOGS_UNAVAILABLE' }));
    }
  } else {
    const before = JSON.parse(readFileSync(snapshot, 'utf8'));
    if (JSON.stringify(metadata.refs) !== JSON.stringify(before.refs))
      throw new Error('VOICE_SECRET_REFERENCES_CHANGED');
    for (const [path, expectedStatus] of [
      ['/health', 'ok'],
      ['/ready', 'ready'],
    ]) {
      const response = await fetch(`https://claimflow-api-vb6ijwpumq-ts.a.run.app${path}`, {
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok || (await response.json()).status !== expectedStatus)
        throw new Error('STABLE_URL_HEALTH_FAILED');
    }
    console.log(
      JSON.stringify({ event: 'STABLE_URL_HEALTH_VERIFIED', health: 'ok', ready: 'ready' }),
    );
  }
  console.log(JSON.stringify({ event: 'VOICE_RELEASE_METADATA', stage, ...metadata }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  run().catch((error) => {
    // Only our fixed error codes are printable; fetch/SDK failures may contain request details.
    const code =
      typeof error?.message === 'string' &&
      /^(VOICE_SECRET_REFERENCE_INVALID:[A-Z_]+|REVISION_NOT_READY|REVISION_NOT_SERVING_ALL_TRAFFIC|RUNTIME_IDENTITY_CHANGED|CLOUD_METADATA_UNAVAILABLE|CLOUD_METADATA_INVALID|INVALID_VERIFICATION_ARGUMENTS|VOICE_SECRET_REFERENCES_CHANGED|STABLE_URL_HEALTH_FAILED)$/.test(
        error.message,
      )
        ? error.message
        : 'RELEASE_VERIFICATION_FAILED';
    console.error(code);
    process.exitCode = 1;
  });
