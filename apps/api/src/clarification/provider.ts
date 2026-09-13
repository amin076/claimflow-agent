import type { ClarificationRequest } from '@claimflow/domain';
import type { Environment } from '@claimflow/config';
import { z } from 'zod';
import { ApiError } from '../errors.js';

export interface ClarificationVoiceProvider {
  call(
    request: ClarificationRequest,
    claimantName: string,
  ): Promise<{ conversationId: string; callId: string }>;
}
export class ElevenLabsVoiceProvider implements ClarificationVoiceProvider {
  constructor(
    private readonly env: Environment,
    private readonly send: typeof fetch = fetch,
  ) {}
  async call(request: ClarificationRequest, claimantName: string) {
    try {
      const response = await this.send('https://api.elevenlabs.io/v1/convai/twilio/outbound-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': this.env.ELEVENLABS_API_KEY! },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          agent_id: this.env.ELEVENLABS_AGENT_ID,
          agent_phone_number_id: this.env.ELEVENLABS_PHONE_NUMBER_ID,
          to_number: this.env.CLARIFICATION_TEST_PHONE,
          call_recording_enabled: false,
          conversation_initiation_client_data: {
            dynamic_variables: {
              case_id: request.caseId,
              clarification_id: request.id,
              claimant_name: claimantName.slice(0, 200),
              affected_field: request.fieldName,
              candidate_values: request.candidateValues.join(' / '),
              clarification_question: request.question,
            },
          },
        }),
      });
      if (!response.ok) throw new Error('Provider rejected call');
      const result = z
        .object({
          success: z.literal(true),
          conversation_id: z.string().min(1).max(160),
          callSid: z.string().min(1).max(160),
        })
        .parse(await response.json());
      return { conversationId: result.conversation_id, callId: result.callSid };
    } catch {
      // Network errors may mean the call was accepted. Never retry automatically.
      throw new ApiError(
        502,
        'VOICE_START_UNCONFIRMED',
        'Call start could not be confirmed. Check ElevenLabs before attempting another call.',
      );
    }
  }
}
