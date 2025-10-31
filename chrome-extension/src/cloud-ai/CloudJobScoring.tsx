import { useState, useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { LocalJobScoringStream } from "../local-ai/LocalJobScoringStream";
import { RippleWaveButton } from "../side-panel/components/RippleWaveButton";
import type { LinkedInBasicJobInfo, LinkedInJobDetailsPayload } from "../shared/linkedin";
import type { JobScoringResult } from "../local-ai/scoring-utils";
import { scoreJobWithCloudAI, type CloudAIStreamResult } from "./scoreJobWithCloudAI";
import { useAuthToken } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { cn } from "@/lib/utils";

interface CloudJobScoringProps {
  onScoreComplete?: (result: JobScoringResult, jobDetails: LinkedInJobDetailsPayload) => void;
  triggerRescore?: number;
  className?: string;
  onQuotaExceededChange?: (exceeded: boolean) => void;
  basicJobInfo?: LinkedInBasicJobInfo | null;
  jobKey: string;
  onStreamingStatusChange?: (status: "idle" | "initializing" | "streaming" | "error") => void;
}

type ScoringState = "idle" | "streaming" | "error";

type CollectLinkedInResponse =
  | {
      success: true;
      payload: LinkedInJobDetailsPayload;
    }
  | {
      success: false;
      error?: string;
    };

export function CloudJobScoring({
  onScoreComplete,
  triggerRescore,
  className,
  onQuotaExceededChange,
  basicJobInfo,
  jobKey,
  onStreamingStatusChange,
}: CloudJobScoringProps) {
  const { isAuthenticated } = useConvexAuth();
  const authToken = useAuthToken();
  const [scoringState, setScoringState] = useState<ScoringState>("idle");
  const [streamResult, setStreamResult] = useState<CloudAIStreamResult | null>(null);
  const [jobDetails, setJobDetails] = useState<LinkedInJobDetailsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rescoreNonce, setRescoreNonce] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastTriggerRef = useRef<{ jobKey: string; trigger: number }>({ jobKey: "", trigger: 0 });

  const handleScoreJob = async () => {
    setError(null);
    onQuotaExceededChange?.(false);

    if (!isAuthenticated) {
      setError("You need to be signed in to score jobs with cloud AI.");
      setScoringState("error");
      onStreamingStatusChange?.("error");
      return;
    }

    // Abort any in-flight scoring request before starting a new one
    abortControllerRef.current?.abort();
    const currentController = new AbortController();
    abortControllerRef.current = currentController;

    setScoringState("streaming");
    onStreamingStatusChange?.("initializing");
    setStreamResult(null);
    setJobDetails(null);

    try {
      if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
        throw new Error("Chrome extension APIs are unavailable. Reload the extension and try again.");
      }

      const response = (await chrome.runtime.sendMessage({
        type: "REQUEST_LINKEDIN_JOB_DETAILS",
      })) as CollectLinkedInResponse;

      if (!response?.success || !response.payload) {
        throw new Error(
          (response as { error?: string }).error ||
            "We couldn't read the LinkedIn job details. Make sure the job page is fully loaded before scoring.",
        );
      }

      if (!authToken) {
        throw new Error("Unable to authenticate with the ApplyFa.st server. Please sign in again.");
      }

      const details = response.payload;
      setJobDetails(details);

      const stream = await scoreJobWithCloudAI({
        job: details,
        token: authToken,
        signal: currentController.signal,
      });

      setStreamResult({
        ...stream,
      });
      setRescoreNonce((prev) => prev + 1);
    } catch (err) {
      if (currentController.signal.aborted) {
        // Job change or manual cancel - reset state without showing an error
        setScoringState("idle");
        setStreamResult(null);
        setJobDetails(null);
        onStreamingStatusChange?.("idle");
        return;
      }

      console.error("[CloudJobScoring] Failed to start scoring", err);
      const message = err instanceof Error ? err.message : "Failed to score job with cloud AI. Please try again.";
      setError(message);
      const quotaExceeded = message.toLowerCase().includes("daily ai usage limit exceeded");
      onQuotaExceededChange?.(quotaExceeded);
      setScoringState("error");
      onStreamingStatusChange?.("error");
    } finally {
      if (abortControllerRef.current === currentController) {
        abortControllerRef.current = null;
      }
    }
  };

  useEffect(() => {
    const prev = lastTriggerRef.current;
    const jobChanged = jobKey !== prev.jobKey;
    const triggerIncremented = (triggerRescore ?? 0) > prev.trigger;
    lastTriggerRef.current = { jobKey, trigger: triggerRescore ?? 0 };

    if (!jobChanged && triggerIncremented && (triggerRescore ?? 0) > 0) {
      void handleScoreJob();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerRescore, jobKey]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      onStreamingStatusChange?.("idle");
    };
  }, [onStreamingStatusChange]);

  useEffect(() => {
    if (scoringState === "idle") {
      onStreamingStatusChange?.("idle");
    }
  }, [scoringState, onStreamingStatusChange]);

  if (scoringState === "streaming") {
    // Show streaming UI once we have stream result and job details
    if (streamResult && jobDetails) {
      return (
        <div className={cn("space-y-4", className)}>
          <LocalJobScoringStream
            key={rescoreNonce}
            streamResult={streamResult}
            jobTitle={jobDetails.title ?? undefined}
            jobCompany={jobDetails.companyName ?? undefined}
            jobLocation={jobDetails.location ?? undefined}
            mode="cloud"
            onComplete={(result) => {
              onScoreComplete?.(result, jobDetails);
            }}
            onError={(errMessage) => {
              setError(errMessage);
              setScoringState("error");
            }}
            onStreamStart={() => {
              onStreamingStatusChange?.("streaming");
            }}
          />
        </div>
      );
    }

    // Stream request has started but we have not received any payload yet.
    return (
      <div
        className={cn(
          "relative flex w-full flex-1 items-center justify-center min-h-[280px]",
          className,
        )}
      >
        <RippleWaveButton
          disabled
          thinking
          title="Analyzing job match..."
          jobTitle={basicJobInfo?.title ?? jobDetails?.title ?? null}
          company={basicJobInfo?.company ?? jobDetails?.companyName ?? null}
          location={basicJobInfo?.location ?? jobDetails?.location ?? null}
        />
      </div>
    );
  }

  // Error state - only show if there's an error
  if (error) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <div className="space-y-1">
              <p className="text-xs font-medium text-destructive">Cloud Scoring Unavailable</p>
              <p className="text-xs leading-relaxed text-destructive/80">
                {error.toLowerCase().includes("daily ai usage limit exceeded")
                  ? "You've reached today's cloud AI limit. Try the local model or come back tomorrow."
                  : error}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Ready to score - return null, the button is in the footer
  return null;
}
