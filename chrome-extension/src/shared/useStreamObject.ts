/**
 * useStreamObject Hook
 *
 * Custom React hook for consuming streaming object results from AI SDK.
 * Provides clean state management for partial updates, completion, and errors.
 */

import { useState, useEffect, useRef } from 'react';
import type { StreamResult, JobScoringResult, StreamState } from './streaming-types';

interface UseStreamObjectOptions {
  streamResult: StreamResult | null;
  onComplete?: (result: JobScoringResult) => void;
  onError?: (error: string) => void;
}

interface UseStreamObjectReturn {
  partialScore: number | undefined;
  partialDescription: string;
  partialRequirementChecks: JobScoringResult['requirementChecks'];
  finalResult: JobScoringResult | null;
  streamState: StreamState;
  error: string | null;
}

/**
 * Hook for managing streaming object state
 *
 * Handles the async iteration over the stream, tracks partial updates,
 * and manages completion/error states with proper cleanup.
 *
 * @example
 * ```tsx
 * const { partialScore, partialDescription, streamState } = useStreamObject({
 *   streamResult,
 *   onComplete: (result) => console.log('Done!', result),
 *   onError: (err) => console.error(err),
 * });
 * ```
 */
export function useStreamObject({
  streamResult,
  onComplete,
  onError,
}: UseStreamObjectOptions): UseStreamObjectReturn {
  const [streamState, setStreamState] = useState<StreamState>('idle');
  const [partialScore, setPartialScore] = useState<number | undefined>(undefined);
  const [partialDescription, setPartialDescription] = useState<string>('');
  const [partialRequirementChecks, setPartialRequirementChecks] = useState<JobScoringResult['requirementChecks']>(undefined);
  const [finalResult, setFinalResult] = useState<JobScoringResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track if we've already completed to prevent re-execution
  const hasCompletedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  // Update refs when callbacks change (but don't re-run effect)
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onComplete, onError]);

  // Main streaming effect
  useEffect(() => {
    // Reset completion flag when a new stream arrives
    if (streamResult) {
      hasCompletedRef.current = false;
    }
    
    // Guard: Don't re-run if no stream
    if (!streamResult) {
      return;
    }

    let cancelled = false;

    async function consumeStream() {
      try {
        setStreamState('streaming');
        console.log('[useStreamObject] Starting stream consumption...');

        let chunkCount = 0;
        let lastScore: number | undefined = undefined;
        let lastDescription: string = '';
        let lastRequirementChecks: JobScoringResult['requirementChecks'] = undefined;

        // Iterate over the partial object stream for real-time updates
        if (!streamResult?.partialObjectStream) {
          throw new Error("streamResult or its partialObjectStream is null.");
        }
        for await (const partial of streamResult.partialObjectStream) {
          chunkCount++;
          console.log(`[useStreamObject] Chunk ${chunkCount}:`, partial);

          if (cancelled) {
            console.log('[useStreamObject] Cancelled during streaming, returning');
            return;
          }

          // Update UI as data streams in AND track local variables
          if (partial && typeof partial === 'object') {
            if (partial.score !== undefined) {
              lastScore = partial.score;
              setPartialScore(partial.score);
            }
            if (partial.description) {
              lastDescription = partial.description;
              setPartialDescription(partial.description);
            }
            if (partial.requirementChecks) {
              lastRequirementChecks = partial.requirementChecks;
              setPartialRequirementChecks(partial.requirementChecks);
            }
          }
        }

        console.log('[useStreamObject] ✅ Stream loop completed! Total chunks:', chunkCount);

        if (cancelled) {
          console.log('[useStreamObject] Cancelled after loop completed');
          return;
        }

        // Stream completed successfully - use the last partial data as final result
        if (lastScore !== undefined && lastDescription) {
          const result: JobScoringResult = {
            score: lastScore,
            description: lastDescription,
            requirementChecks: lastRequirementChecks,
          };

          console.log('[useStreamObject] Setting final result:', result);
          setFinalResult(result);
          setStreamState('completed');
          hasCompletedRef.current = true; // Mark as completed to prevent re-execution
          onCompleteRef.current?.(result);
        } else {
          console.error('[useStreamObject] ❌ Incomplete data');
          throw new Error('Model returned an incomplete evaluation.');
        }
      } catch (err) {
        if (cancelled) return;

        console.error('[useStreamObject] Error during stream consumption:', err);
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to process stream. Please try again.';
        setError(errorMessage);
        setStreamState('error');
        onErrorRef.current?.(errorMessage);
      }
    }

    consumeStream();

    return () => {
      cancelled = true;
      console.log('[useStreamObject] Component cleanup - cancelled set to true');
    };
  }, [streamResult]);

  // Reset state when streamResult changes
  useEffect(() => {
    if (streamResult) {
      hasCompletedRef.current = false;
      setStreamState('idle');
      setPartialScore(undefined);
      setPartialDescription('');
      setPartialRequirementChecks(undefined);
      setFinalResult(null);
      setError(null);
    }
  }, [streamResult]);

  return {
    partialScore,
    partialDescription,
    partialRequirementChecks,
    finalResult,
    streamState,
    error,
  };
}
