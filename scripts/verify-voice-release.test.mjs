import { describe, expect, it } from 'vitest';
import { safeMetadata } from './verify-voice-release.mjs';
const names = [
  'ELEVENLABS_API_KEY',
  'ELEVENLABS_AGENT_ID',
  'ELEVENLABS_PHONE_NUMBER_ID',
  'ELEVENLABS_WEBHOOK_SECRET',
  'CLARIFICATION_REVIEW_TOKEN',
  'CLARIFICATION_TEST_PHONE',
];
const ids = [
  'claimflow-elevenlabs-api-key',
  'claimflow-elevenlabs-agent-id',
  'claimflow-elevenlabs-phone-id',
  'claimflow-elevenlabs-webhook-secret',
  'claimflow-clarification-review-token',
  'claimflow-clarification-test-phone',
];
function service() {
  return {
    spec: {
      template: {
        spec: {
          serviceAccountName: 'claimflow-api-runtime@claimflow-ai-agents.iam.gserviceaccount.com',
          containers: [
            {
              env: names.map((name, i) => ({
                name,
                valueFrom: { secretKeyRef: { name: ids[i], key: i === 5 ? '2' : '1' } },
              })),
            },
          ],
        },
      },
    },
    status: {
      latestReadyRevisionName: 'claimflow-api-00017-24b',
      traffic: [{ revisionName: 'claimflow-api-00017-24b', percent: 100 }],
    },
  };
}
describe('secret reference release guard', () => {
  it('returns only allowlisted reference metadata, never literal values', () => {
    const s = service();
    s.spec.template.spec.containers[0].env.push({ name: 'UNRELATED', value: 'private-value' });
    const result = safeMetadata(s);
    expect(Object.keys(result.refs)).toHaveLength(6);
    expect(JSON.stringify(result)).not.toContain('private-value');
  });
  it('rejects missing or plaintext credentials without exposing them', () => {
    const s = service();
    s.spec.template.spec.containers[0].env[0] = { name: names[0], value: 'private-value' };
    expect(() => safeMetadata(s)).toThrow('VOICE_SECRET_REFERENCE_INVALID:ELEVENLABS_API_KEY');
  });
  it('rejects traffic on an unexpected revision', () => {
    const s = service();
    s.status.traffic[0].percent = 50;
    expect(() => safeMetadata(s)).toThrow('REVISION_NOT_SERVING_ALL_TRAFFIC');
  });
});
