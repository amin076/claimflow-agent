import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { z } from 'zod';
import type { Environment } from '@claimflow/config';
import type { CaseRepository } from '../persistence.js';
import { ApiError } from '../errors.js';
import { audit } from './service.js';

const EventSchema = z.object({
  type: z.enum(['post_call_transcription', 'call_initiation_failure']),
  data: z.object({
    agent_id: z.string(),
    conversation_id: z.string().min(1).max(160),
    status: z.string().optional(),
    transcript: z
      .array(z.object({ role: z.enum(['agent', 'user']), message: z.string().nullable() }))
      .optional(),
  }),
});
export async function receiveWebhook(
  raw: string,
  signature: unknown,
  env: Environment,
  cases: CaseRepository,
) {
  if (!env.ELEVENLABS_WEBHOOK_SECRET)
    throw new ApiError(503, 'WEBHOOK_NOT_CONFIGURED', 'Webhook unavailable.');
  let verified: unknown;
  try {
    if (typeof signature !== 'string') throw new Error();
    const timestamp = signature
      .split(',')
      .find((part) => part.startsWith('t='))
      ?.slice(2);
    if (!timestamp || !/^\d+$/.test(timestamp) || Number(timestamp) * 1000 > Date.now() + 60000)
      throw new Error();
    verified = await new ElevenLabsClient({
      apiKey: env.ELEVENLABS_API_KEY ?? 'webhook-only',
    }).webhooks.constructEvent(raw, signature, env.ELEVENLABS_WEBHOOK_SECRET);
  } catch {
    throw new ApiError(401, 'INVALID_WEBHOOK_SIGNATURE', 'Invalid webhook signature.');
  }
  const parsed = EventSchema.safeParse(verified);
  if (!parsed.success)
    throw new ApiError(400, 'INVALID_WEBHOOK_EVENT', 'Unsupported webhook event.');
  const event = parsed.data;
  if (event.data.agent_id !== env.ELEVENLABS_AGENT_ID)
    throw new ApiError(400, 'UNKNOWN_VOICE_AGENT', 'Unknown voice agent.');
  // Resolve via persisted outbound result, never caller-provided case IDs/dynamic variables.
  const found = await cases.findConversation(event.data.conversation_id);
  if (!found)
    throw new ApiError(503, 'CONVERSATION_NOT_MAPPED', 'Conversation mapping not yet available.');
  await cases.update(found.id, (claim) => {
    const item = claim.clarifications?.find(
      (item) => item.externalConversationId === event.data.conversation_id,
    );
    if (!item)
      throw new ApiError(503, 'CONVERSATION_NOT_MAPPED', 'Conversation mapping unavailable.');
    if (['COMPLETED', 'RESOLVED', 'FAILED'].includes(item.status)) return claim;
    if (item.status !== 'CALLING')
      throw new ApiError(409, 'INVALID_CLARIFICATION_STATE', 'No call is in progress.');
    item.completedAt = new Date().toISOString();
    if (event.type === 'call_initiation_failure' || event.data.status === 'failed') {
      item.status = 'FAILED';
      item.errorSummary = 'VOICE_CALL_FAILED';
      audit(claim, item, 'VOICE_CALL_FAILED', undefined, true);
      return claim;
    }
    if (event.data.status !== 'done' || !event.data.transcript)
      throw new ApiError(400, 'INCOMPLETE_TRANSCRIPT', 'A completed transcript is required.');
    let remaining = 20000;
    let truncated = event.data.transcript.length > 100;
    const transcript = event.data.transcript.slice(0, 100).flatMap((turn) => {
      if (!turn.message) return [];
      const message = turn.message.slice(0, Math.min(4000, remaining));
      truncated ||= message.length !== turn.message.length;
      remaining -= message.length;
      return message ? [{ role: turn.role, message }] : [];
    });
    item.response = {
      id: `response-${item.id}`,
      clarificationId: item.id,
      caseId: claim.id,
      channel: 'VOICE',
      receivedAt: item.completedAt,
      externalConversationId: event.data.conversation_id,
      transcript,
      transcriptTruncated: truncated,
      verification: 'ELEVENLABS_HMAC',
    };
    item.status = 'COMPLETED';
    audit(claim, item, 'VOICE_CALL_COMPLETED');
    audit(claim, item, 'CLARIFICATION_RESPONSE_RECEIVED');
    // Fields, issues, reviews and case routing deliberately remain untouched.
    return claim;
  });
  return { status: 'received' };
}
