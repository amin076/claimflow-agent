import { ApiError } from '../errors.js';

// Only allowlisted categories leave this boundary. Provider messages can contain source text.
export function describeProviderError(error: unknown) {
  const value = error && typeof error === 'object' ? error : {};
  const statusValue = 'status' in value ? value.status : 'code' in value ? value.code : undefined;
  const status = Number(statusValue);
  const httpStatus =
    Number.isInteger(status) && status >= 400 && status <= 599 ? status : undefined;
  const message = error instanceof Error ? error.message : '';
  const name = error instanceof Error ? error.name : '';
  let category = 'VERTEX_CLIENT_ERROR';
  let guidance =
    'The SDK failed without a recognized HTTP status. Check runtime configuration and connectivity.';
  if (httpStatus === 400) {
    category = 'VERTEX_REQUEST_REJECTED';
    guidance =
      'Vertex rejected the request. Check model support, generation settings and response schema.';
  } else if (httpStatus === 401 || httpStatus === 403) {
    category = 'VERTEX_ACCESS_DENIED';
    guidance =
      'Check runtime identity, Vertex AI permissions, API activation and project restrictions.';
  } else if (httpStatus === 404) {
    category = 'VERTEX_MODEL_UNAVAILABLE';
    guidance = 'Check model availability for this project and location.';
  } else if (httpStatus === 429) {
    category = 'VERTEX_RATE_LIMIT';
    guidance = 'Check quota and rate limits.';
  } else if (httpStatus && httpStatus >= 500) {
    category = 'VERTEX_SERVICE_ERROR';
    guidance = 'Vertex returned a server error.';
  } else if (name === 'AbortError' || name === 'TimeoutError') {
    category = 'VERTEX_TIMEOUT';
    guidance = 'The request was aborted or timed out.';
  }
  const hint = /response.?json.?schema|response.?schema/i.test(message)
    ? 'RESPONSE_SCHEMA'
    : /default credentials|could not load.*credentials/i.test(message)
      ? 'APPLICATION_CREDENTIALS'
      : /fetch failed|ENOTFOUND|ECONNRESET|ETIMEDOUT/i.test(message)
        ? 'NETWORK'
        : 'UNCLASSIFIED';
  return { category, ...(httpStatus ? { httpStatus } : {}), hint, guidance };
}

export function reportProviderError(error: unknown): ApiError {
  const diagnostic = describeProviderError(error);
  console.error(
    JSON.stringify({
      severity: 'ERROR',
      event: 'VERTEX_EXTRACTION_FAILED',
      message: `${diagnostic.category}: ${diagnostic.guidance}`,
      ...diagnostic,
    }),
  );
  return new ApiError(
    502,
    diagnostic.category,
    `${diagnostic.httpStatus ? `HTTP ${diagnostic.httpStatus}. ` : ''}${diagnostic.hint}. ${diagnostic.guidance} No automatic retry was made.`,
  );
}
