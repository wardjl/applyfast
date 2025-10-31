/**
 * Shared Streaming Types
 *
 * Type definitions for AI streaming responses used across both local and cloud AI.
 * These types ensure consistency between client and server streaming implementations.
 */

import { z } from 'zod';
import { jobScoringSchema, type JobScoringResult } from '../../../lib/schemas/jobScoring';

// Re-export from shared schema for backward compatibility
export { jobScoringSchema, type JobScoringResult };

/**
 * Stream chunk types for parsing server responses
 */
export type StreamChunk =
  | { type: 'partial'; data: Partial<JobScoringResult> }
  | { type: 'final'; data: JobScoringResult }
  | { type: 'error'; error: string };

/**
 * Unified stream result interface
 * Both local and cloud AI implementations should return this interface
 */
export interface StreamResult {
  partialObjectStream: AsyncGenerator<Partial<JobScoringResult>, void, unknown>;
}

/**
 * Stream state for UI components
 */
export type StreamState = 'idle' | 'streaming' | 'completed' | 'error';

/**
 * Error types for better error handling
 */
export class StreamError extends Error {
  constructor(
    message: string,
    public readonly code: StreamErrorCode,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'StreamError';
  }
}

export type StreamErrorCode =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'AUTH_ERROR'
  | 'QUOTA_EXCEEDED'
  | 'INVALID_RESPONSE'
  | 'STREAM_INTERRUPTED'
  | 'AI_UNAVAILABLE';
