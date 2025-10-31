/**
 * LocalJobScoringStream - Streaming UI for job scoring
 *
 * Modernized component using the useStreamObject hook for cleaner state management.
 * Displays real-time streaming results from both local AI and cloud AI with a unified interface.
 */

import { useEffect, useRef } from 'react';
import { Loader2, AlertTriangle, Building2, MapPin, CheckCircle2, XCircle } from 'lucide-react';
import { useStreamObject } from '../shared/useStreamObject';
import type { StreamResult, JobScoringResult } from '../shared/streaming-types';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { getScoreDescription } from './scoring-utils';
import { ScoreChart } from '../side-panel/components/ScoreChart';

interface LocalJobScoringStreamProps {
  streamResult: StreamResult;
  jobTitle?: string;
  jobCompany?: string;
  jobLocation?: string;
  onComplete?: (result: JobScoringResult) => void;
  onError?: (error: string) => void;
  onStreamStart?: () => void;
}

export function LocalJobScoringStream({
  streamResult,
  jobTitle,
  jobCompany,
  jobLocation,
  onComplete,
  onError,
  onStreamStart,
}: LocalJobScoringStreamProps) {
  // Get user profile for role requirements
  const userProfile = useQuery(api.userProfiles.getUserProfile);

  // Use the custom hook for clean state management
  const {
    partialScore,
    partialDescription,
    partialRequirementChecks,
    finalResult,
    streamState,
    error,
  } = useStreamObject({
    streamResult,
    onComplete,
    onError,
  });

  const displayScore = finalResult?.score ?? partialScore;
  const displayDescription = finalResult?.description ?? partialDescription;
  const displayRequirementChecks = finalResult?.requirementChecks ?? partialRequirementChecks;
  const hasRenderableData =
    displayScore !== undefined ||
    (typeof displayDescription === 'string' && displayDescription.trim().length > 0) ||
    (displayRequirementChecks && displayRequirementChecks.length > 0);

  // Notify parent the moment streaming transitions from idle to streaming
  const hasNotifiedStartRef = useRef(false);
  useEffect(() => {
    if (!hasNotifiedStartRef.current && hasRenderableData) {
      hasNotifiedStartRef.current = true;
      onStreamStart?.();
    }
  }, [hasRenderableData, onStreamStart]);

  // Error state
  if (streamState === 'error' && error) {
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <div className="space-y-1">
              <p className="text-xs font-medium text-destructive">Scoring Failed</p>
              <p className="text-xs leading-relaxed text-destructive/80">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!hasRenderableData) {
    return null;
  }

  // Streaming or completed state - use same layout as saved jobs
  const isStreaming = streamState === 'streaming';

  return (
    <div className="space-y-4" style={{ paddingBottom: "24px" }}>
      {/* Job header card */}
      <div className="rounded-xl border bg-card text-card-foreground p-4 shadow-none">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              {jobTitle && (
                <h3 className="font-semibold text-base leading-tight mb-2">
                  {jobTitle}
                </h3>
              )}
              {jobCompany && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate font-medium">{jobCompany}</span>
                </div>
              )}
              {jobLocation && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground" style={{ marginTop: "0.25rem" }}>
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate font-medium">{jobLocation}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              {displayScore !== undefined ? (
                <ScoreChart score={displayScore} size="lg" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
                  --
                </div>
              )}
            </div>
          </div>

          {displayScore !== undefined && (() => {
            const metRequirementsCount = displayRequirementChecks?.filter(c => c.score === 1).length || 0;
            const score = displayScore;

            // Determine color scheme based on score
            let bgColor, textColor, secondaryTextColor, borderColor;
            if (score >= 7) {
              bgColor = "bg-green-50 dark:bg-green-950/30";
              textColor = "text-green-900 dark:text-green-100";
              secondaryTextColor = "text-green-700 dark:text-green-300";
              borderColor = "border-green-200 dark:border-green-800";
            } else if (score >= 5) {
              bgColor = "bg-yellow-50 dark:bg-yellow-950/30";
              textColor = "text-yellow-900 dark:text-yellow-100";
              secondaryTextColor = "text-yellow-700 dark:text-yellow-300";
              borderColor = "border-yellow-200 dark:border-yellow-800";
            } else {
              bgColor = "bg-red-50 dark:bg-red-950/30";
              textColor = "text-red-900 dark:text-red-100";
              secondaryTextColor = "text-red-700 dark:text-red-300";
              borderColor = "border-red-200 dark:border-red-800";
            }

            return (
              <div className={`p-3 ${bgColor} rounded-lg border ${borderColor}`}>
                <p className={`text-sm font-semibold ${textColor}`}>{getScoreDescription(score)}</p>
                <p className={`text-xs ${secondaryTextColor}`}>
                  {metRequirementsCount > 0
                    ? `Aligns with ${metRequirementsCount} of your key requirements`
                    : 'Does not align with any of your key requirements'}
                </p>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Your Requirements card - only show when checks are available */}
      {userProfile?.roleRequirements &&
       userProfile.roleRequirements.length > 0 &&
       displayRequirementChecks &&
       displayRequirementChecks.length > 0 && (
        <div className="rounded-xl border bg-card text-card-foreground p-4 shadow-none">
          <h3 className="text-base font-semibold mb-3">Your Requirements</h3>
          <div className="space-y-2">
            {userProfile.roleRequirements.map((requirement, idx) => {
              const check = displayRequirementChecks?.find(c => c.requirement === requirement);
              const isMet = check?.score === 1;
              const isNotMet = check?.score === 0;

              return (
                <div
                  key={idx}
                  className={`flex items-start gap-2 p-3 rounded-lg transition-all ${
                    isMet
                      ? "bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
                      : isNotMet
                      ? "bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800"
                      : "bg-muted/40 border border-border"
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {isMet ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : isNotMet ? (
                      <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    ) : (
                      <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                    )}
                  </div>
                  <p className={`text-xs ${
                    isMet
                      ? "text-emerald-900 dark:text-emerald-100"
                      : isNotMet
                      ? "text-red-900 dark:text-red-100"
                      : "text-foreground"
                  }`}>
                    {requirement}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Explanation card */}
      {(typeof displayDescription === 'string' && displayDescription.trim().length > 0) && (
        <div className="rounded-xl border bg-card text-card-foreground p-4 shadow-none">
          <h3 className="text-base font-semibold mb-3">Explanation</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {displayDescription}
            {isStreaming && (
              <span className="inline-block ml-1 w-1 h-4 bg-purple-500 animate-pulse" />
            )}
          </p>
        </div>
      )}
    </div>
  );
}
