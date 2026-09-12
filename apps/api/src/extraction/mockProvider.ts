import type { ExtractionProvider, ExtractionRequest } from './provider.js';
export class MockExtractionProvider implements ExtractionProvider {
  readonly model = 'deterministic-local-mock';
  async generate(request: ExtractionRequest) {
    return {
      finishReason: 'STOP',
      text: JSON.stringify({
        fields: [
          {
            name: 'claimant.fullName',
            value: 'Jordan Lee',
            confidence: 0.98,
            evidence: [
              {
                documentId: request.documents[0]!.id,
                page: 1,
                excerpt: 'Synthetic mock: Jordan Lee',
              },
            ],
            uncertaintyReasons: [],
          },
          {
            name: 'incident.date',
            value: '2026-09-08',
            confidence: 0.62,
            evidence: [
              {
                documentId: request.documents[0]!.id,
                page: 1,
                excerpt: 'Synthetic mock: 08/09/26',
              },
            ],
            uncertaintyReasons: ['Mock ambiguity for demonstration.'],
          },
          {
            name: 'damage.description',
            value: 'Water staining and ceiling damage',
            confidence: 0.91,
            evidence: [
              {
                documentId: request.documents[0]!.id,
                page: 1,
                excerpt: 'Synthetic mock: Water staining and ceiling damage',
              },
            ],
            uncertaintyReasons: [],
          },
        ],
        missingFields: ['incident.address'],
        quality: {
          usable: true,
          notes: ['Mock result; uploaded content was not read by an AI model.'],
        },
      }),
    };
  }
}
