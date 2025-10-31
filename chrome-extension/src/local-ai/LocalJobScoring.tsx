/**
 * LocalJobScoring - UI component for local AI-powered job scoring
 *
 * This component provides on-device job scoring using Chrome's built-in Gemini Nano model.
 * It displays results using the same UI patterns as the cloud-based scoring system.
 */

import { useState, useEffect, useRef } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isChromeAIAvailable, getChromeAICapabilities } from './chrome-ai-provider';
import { scoreJobWithLocalAI, type JobScoringResult } from './scoring-utils';
import { LocalJobScoringStream } from './LocalJobScoringStream';
import type { LinkedInBasicJobInfo, LinkedInJobDetailsPayload } from '../shared/linkedin';
import type { Doc } from '@/convex/_generated/dataModel';

interface LocalJobScoringProps {
  userProfile: Doc<'userProfiles'> | null;
  interviewSummary?: string | null;
  scoringCriteria?: string | null;
  defaultScoringCriteria?: string | null;
  onScoreComplete?: (result: JobScoringResult, jobDetails: LinkedInJobDetailsPayload) => void;
  onAvailabilityChange?: (available: boolean) => void; // Notify parent of availability status
  triggerRescore?: number; // Increment this value to trigger an immediate re-score
  className?: string;
  basicJobInfo?: LinkedInBasicJobInfo | null;
  jobKey: string;
  onStreamingStatusChange?: (status: 'idle' | 'initializing' | 'streaming' | 'error') => void;
}

type ScoringState = 'idle' | 'checking' | 'ready' | 'streaming' | 'error';

export function LocalJobScoring({
  userProfile,
  interviewSummary,
  scoringCriteria,
  defaultScoringCriteria,
  onScoreComplete,
  onAvailabilityChange,
  triggerRescore,
  className,
  basicJobInfo,
  jobKey,
  onStreamingStatusChange,
}: LocalJobScoringProps) {
  const [scoringState, setScoringState] = useState<ScoringState>('idle');
  const [isAIAvailable, setIsAIAvailable] = useState<boolean | null>(null);
  const [aiCapabilities, setAICapabilities] = useState<any>(null);
  const [streamResult, setStreamResult] = useState<any>(null);
  const [jobDetails, setJobDetails] = useState<LinkedInJobDetailsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastTriggerRef = useRef<{ jobKey: string; trigger: number }>({ jobKey: "", trigger: 0 });

  const handleCheckAIAvailability = async () => {
    setScoringState('checking');
    setError(null);

    try {
      const available = await isChromeAIAvailable();
      setIsAIAvailable(available);

      // Notify parent of availability status
      const isFullyAvailable = available && (await getChromeAICapabilities())?.available === 'readily';
      onAvailabilityChange?.(isFullyAvailable);

      if (available) {
        const capabilities = await getChromeAICapabilities();
        setAICapabilities(capabilities);

        if (capabilities.available === 'after-download') {
          setError('Chrome AI is available but needs to be downloaded. This may take a few minutes.');
          onAvailabilityChange?.(false); // Not available yet
        }
      } else {
        setError(
          'Chrome AI is not available. Please use Chrome Canary or Dev with the "Prompt API for Gemini Nano" flag enabled.'
        );
        onAvailabilityChange?.(false);
      }

      setScoringState('ready');
    } catch (err) {
      console.error('Error checking AI availability:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to check Chrome AI availability. Make sure you are using a compatible Chrome version.'
      );
      setIsAIAvailable(false);
      onAvailabilityChange?.(false);
      setScoringState('error');
    }
  };

  const handleScoreJob = async () => {
    abortControllerRef.current?.abort();
    const currentController = new AbortController();
    abortControllerRef.current = currentController;

    setScoringState('streaming');
    setError(null);
    setStreamResult(null);
    setJobDetails(null);
    onStreamingStatusChange?.('initializing');

    try {
      // Verify chrome.runtime is available
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        throw new Error('Chrome extension API not available. Please reload the extension.');
      }

      // Request LinkedIn job details from the content script
      const response = await chrome.runtime.sendMessage({
        type: 'REQUEST_LINKEDIN_JOB_DETAILS',
      });

      if (!response?.success || !response.payload) {
        throw new Error(
          response?.error ||
            "Couldn't read the LinkedIn job details. Make sure the job page is fully loaded."
        );
      }

      const details: LinkedInJobDetailsPayload = response.payload;
      setJobDetails(details);

      // Score the job using local AI - returns stream result
      const stream = await scoreJobWithLocalAI(
        details,
        userProfile,
        interviewSummary,
        scoringCriteria,
        defaultScoringCriteria,
        currentController.signal
      );
      setStreamResult(stream);
    } catch (err) {
      if (currentController.signal.aborted) {
        setScoringState('idle');
        setStreamResult(null);
        setJobDetails(null);
        onStreamingStatusChange?.('idle');
        return;
      }

      console.error('Error scoring job:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to score job. Please try again or use cloud-based scoring.'
      );
      setScoringState('error');
      onStreamingStatusChange?.('error');
    } finally {
      if (abortControllerRef.current === currentController) {
        abortControllerRef.current = null;
      }
    }
  };

  // Auto-check AI availability on mount
  useEffect(() => {
    handleCheckAIAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trigger immediate re-scoring when triggerRescore changes
  useEffect(() => {
    const prev = lastTriggerRef.current;
    const jobChanged = jobKey !== prev.jobKey;
    const triggerIncremented = (triggerRescore ?? 0) > prev.trigger;
    lastTriggerRef.current = { jobKey, trigger: triggerRescore ?? 0 };

    if (!jobChanged && triggerIncremented && (triggerRescore ?? 0) > 0) {
      setStreamResult(null);
      setJobDetails(null);
      setError(null);
      void handleScoreJob();
    } else if (jobChanged) {
      // Reset UI when switching to a new job
      setScoringState('idle');
      setStreamResult(null);
      setJobDetails(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerRescore, jobKey]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      onStreamingStatusChange?.('idle');
    };
  }, [onStreamingStatusChange]);

  useEffect(() => {
    if (scoringState === 'idle') {
      onStreamingStatusChange?.('idle');
    }
  }, [scoringState, onStreamingStatusChange]);

  // Show streaming UI when we have a stream result
  if (scoringState === 'streaming') {
    // Show streaming UI once we have stream result and job details
    if (streamResult && jobDetails) {
      return (
        <div className={cn('space-y-4', className)}>
          <LocalJobScoringStream
            streamResult={streamResult}
            jobTitle={jobDetails.title ?? undefined}
            jobCompany={jobDetails.companyName ?? undefined}
            jobLocation={jobDetails.location ?? undefined}
            onComplete={(result) => {
              // Pass both result AND jobDetails to parent
              onScoreComplete?.(result, jobDetails);
            }}
            onError={(err) => {
              setError(err);
              setScoringState('error');
            }}
            onStreamStart={() => {
              onStreamingStatusChange?.('streaming');
            }}
          />
        </div>
      );
    }

    // Hide placeholder while we wait for the first streamed chunk
    return null;
  }

  // Checking availability or initial state
  if ((isAIAvailable === null || scoringState === 'checking') && scoringState !== 'ready' && scoringState !== 'error') {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="rounded-md border border-dashed border-border bg-background/40 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-500/10">
              <Loader2 className="h-5 w-5 animate-spin text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">Local AI Scoring</h3>
                <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                  Free
                </span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Checking if your browser's built-in AI is available...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // AI not available
  if (isAIAvailable === false) {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <div className="space-y-1">
              <p className="text-xs font-medium text-destructive">Local AI Unavailable</p>
              <p className="text-xs leading-relaxed text-destructive/80">
                {error || 'Chrome AI is not available on this browser.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // AI available but needs download
  if (aiCapabilities?.available === 'after-download') {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="rounded-md border border-orange-500/30 bg-orange-500/10 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" />
            <div className="space-y-1">
              <p className="text-xs font-medium text-orange-600 dark:text-orange-400">
                Download Required
              </p>
              <p className="text-xs leading-relaxed text-orange-600/80 dark:text-orange-400/80">
                Chrome needs to download the AI model. This happens automatically in the background.
                Try again in a few minutes.
              </p>
            </div>
          </div>
        </div>
        <Button onClick={handleCheckAIAvailability} variant="outline" size="sm" className="w-full">
          Check Again
        </Button>
      </div>
    );
  }

  // Error state (only for errors before streaming starts)
  if (scoringState === 'error' && error) {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <div className="space-y-1">
              <p className="text-xs font-medium text-destructive">Scoring Failed</p>
              <p className="text-xs leading-relaxed text-destructive/80">{error}</p>
            </div>
          </div>
        </div>
        <Button onClick={handleScoreJob} variant="outline" size="sm" className="w-full">
          Try Again
        </Button>
      </div>
    );
  }

  // Ready to score - return null, the button is now in the footer
  return null;
}
