/**
 * Cloud AI Job Scoring Client
 *
 * Modernized implementation using proper stream handling for AI SDK responses.
 * Provides structured job scoring from ApplyFa.st cloud infrastructure.
 */

import type { LinkedInJobDetailsPayload } from '../shared/linkedin';
import type { JobScoringResult, StreamResult } from '../shared/streaming-types';
import { StreamError } from '../shared/streaming-types';

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || 'https://your-deployment.convex.cloud';
// HTTP actions are served on .convex.site, not .convex.cloud
const HTTP_ACTIONS_URL = CONVEX_URL.replace('.convex.cloud', '.convex.site');
const STREAM_ENDPOINT = new URL('/job-scoring/stream', HTTP_ACTIONS_URL).toString();

// Configuration
const REQUEST_TIMEOUT_MS = 60000; // 60 seconds

/**
 * Score a job using cloud AI with streaming results
 *
 * @param job - LinkedIn job details to score
 * @param token - Authentication token for the API
 * @param signal - Optional AbortSignal for cancellation
 * @returns StreamResult with async generator for partial updates
 */
export async function scoreJobWithCloudAI({
  job,
  token,
  signal,
}: {
  job: LinkedInJobDetailsPayload;
  token: string;
  signal?: AbortSignal;
}): Promise<StreamResult> {
  // Create timeout controller
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);

  // Combine user signal with timeout signal
  const combinedSignal = signal
    ? (() => {
        const controller = new AbortController();
        signal.addEventListener('abort', () => controller.abort());
        timeoutController.signal.addEventListener('abort', () => controller.abort());
        return controller.signal;
      })()
    : timeoutController.signal;

  try {
    const response = await fetch(STREAM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ job }),
      signal: combinedSignal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const message = await response.text().catch(() => 'Failed to start cloud scoring');
      throw createStreamError(message, response.status);
    }

    if (!response.body) {
      throw createStreamError('Streaming response not supported in this environment.', 500);
    }

    // Get reader from response body
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    // Create async generator that yields partial objects
    async function* partialObjectStream(): AsyncGenerator<Partial<JobScoringResult>, void, unknown> {
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // Process any remaining data in buffer
            if (buffer.trim()) {
              const parsed = tryParseChunk(buffer.trim());
              if (parsed) {
                yield parsed;
              }
            }
            break;
          }

          // Decode the chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete chunks (separated by newlines)
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) {
              const parsed = tryParseChunk(trimmed);
              if (parsed) {
                yield parsed;
              }
            }
          }
        }
      } catch (error) {
        console.error('[CloudJobScoring] Stream error:', error);
        throw error instanceof Error
          ? error
          : createStreamError('Failed to process stream', 500);
      } finally {
        reader.releaseLock();
      }
    }

    return {
      partialObjectStream: partialObjectStream(),
    };
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle timeout errors
    if (error instanceof Error && error.name === 'AbortError') {
      throw createStreamError(
        `Request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds. Please try again.`,
        408,
        true
      );
    }

    // Re-throw if already a StreamError
    if (error && typeof error === 'object' && 'code' in error) {
      throw error;
    }

    // Wrap unknown errors
    throw error instanceof Error
      ? createStreamError(error.message, 500, false)
      : createStreamError('An unexpected error occurred', 500, false);
  }
}

/**
 * Try to parse a chunk as JSON, return null if it fails
 */
function tryParseChunk(text: string): Partial<JobScoringResult> | null {
  try {
    const parsed = JSON.parse(text);

    // AI SDK's streamObject sends data in specific format
    // It might be the object directly or wrapped
    if (parsed && typeof parsed === 'object') {
      // Check if it's a direct JobScoringResult
      if ('score' in parsed || 'description' in parsed) {
        return parsed as Partial<JobScoringResult>;
      }

      // Check if it's wrapped in a data property
      if (parsed.data && typeof parsed.data === 'object') {
        return parsed.data as Partial<JobScoringResult>;
      }
    }

    return null;
  } catch (error) {
    console.warn('[CloudJobScoring] Failed to parse chunk:', text, error);
    return null;
  }
}

/**
 * Create a typed StreamError with appropriate error code
 */
function createStreamError(message: string, status: number, retryable: boolean = false): StreamError {
  let code: StreamError['code'];
  let finalRetryable = retryable;

  if (status === 401 || status === 403) {
    code = 'AUTH_ERROR';
  } else if (status === 408 || message.includes('timeout')) {
    code = 'TIMEOUT';
    finalRetryable = true;
  } else if (status === 429 || message.toLowerCase().includes('limit exceeded')) {
    code = 'QUOTA_EXCEEDED';
  } else if (status >= 500) {
    code = 'NETWORK_ERROR';
    finalRetryable = true;
  } else if (message.includes('stream') || message.includes('interrupted')) {
    code = 'STREAM_INTERRUPTED';
    finalRetryable = true;
  } else {
    code = 'INVALID_RESPONSE';
  }

  return new StreamError(message, code, finalRetryable);
}

/**
 * Type export for CloudAIStreamResult (for backward compatibility)
 */
export type CloudAIStreamResult = StreamResult;
