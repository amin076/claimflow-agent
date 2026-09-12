import { GoogleGenAI } from '@google/genai';
import type { Environment } from '@claimflow/config';
import { responseJsonSchema, SYSTEM_INSTRUCTION } from './schema.js';

export interface ExtractionDocument {
  id: string;
  bytes: Buffer;
  mimeType: string;
  pageCount: number;
}
export interface ExtractionRequest {
  documents: ExtractionDocument[];
  signal: AbortSignal;
}
export interface ExtractionResponse {
  text: string;
  finishReason: string;
  modelVersion?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}
export interface ExtractionProvider {
  readonly model: string;
  generate(request: ExtractionRequest): Promise<ExtractionResponse>;
}
export class VertexExtractionProvider implements ExtractionProvider {
  private readonly client: GoogleGenAI;
  readonly model: string;
  constructor(private readonly environment: Environment) {
    this.model = environment.GEMINI_MODEL;
    this.client = new GoogleGenAI({
      vertexai: true,
      project: environment.GOOGLE_CLOUD_PROJECT!,
      location: environment.VERTEX_LOCATION,
      httpOptions: { timeout: environment.AI_TIMEOUT_MS, retryOptions: { attempts: 1 } },
    });
  }
  async generate(request: ExtractionRequest): Promise<ExtractionResponse> {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [
        {
          role: 'user',
          parts: request.documents.flatMap((document) => [
            { text: `Source documentId=${document.id}; pages=${document.pageCount}.` },
            {
              inlineData: { mimeType: document.mimeType, data: document.bytes.toString('base64') },
            },
          ]),
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseJsonSchema,
        maxOutputTokens: 8192,
        candidateCount: 1,
        abortSignal: request.signal,
      },
    });
    const candidate = response.candidates?.[0];
    return {
      text: response.text ?? '',
      finishReason: String(candidate?.finishReason ?? 'BLOCKED'),
      ...(response.modelVersion ? { modelVersion: response.modelVersion } : {}),
      ...(response.usageMetadata?.promptTokenCount !== undefined
        ? { inputTokens: response.usageMetadata.promptTokenCount }
        : {}),
      ...(response.usageMetadata?.candidatesTokenCount !== undefined
        ? { outputTokens: response.usageMetadata.candidatesTokenCount }
        : {}),
      ...(response.usageMetadata?.totalTokenCount !== undefined
        ? { totalTokens: response.usageMetadata.totalTokenCount }
        : {}),
    };
  }
}
