import { useState, useEffect } from "react";
import { useAction, useMutation } from "convex/react";
import { BookmarkPlus, Loader2, AlertTriangle, Bookmark, RefreshCw, Sparkles, CheckCircle2, XCircle, MapPin, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RippleWaveButton } from "./RippleWaveButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "../../../../convex/_generated/api";
import type { Doc } from "../../../../convex/_generated/dataModel";
import { useScoringContext } from "../lib/ScoringContextProvider";
import { ScoreChart } from "./ScoreChart";
import type { LinkedInBasicJobInfo, LinkedInJobDetailsPayload, LinkedInJobSection } from "../../shared/linkedin";
import type { JobScoringResult } from "../../shared/streaming-types";
import { getScoreDescription } from "../../local-ai/scoring-utils";
import { getSelectedModel, setSelectedModel as saveSelectedModel } from "../../shared/storage-utils";
import { MODEL_CONFIGS } from "../../shared/model-configs";
import { Badge } from "@/components/ui/badge";

interface JobInsightPlaceholderProps {
  jobUrl: string;
  jobId: string;
  canonicalUrl?: string | null;
  existingJob?: Doc<"jobs"> | null;
  isLoading?: boolean;
  onSavedAndScored?: (jobId: string) => void;
}

type ManualJobArgs = (typeof api.jobScraping.createManualLinkedinJob)["_args"];

type CollectLinkedInResponse = {
  success: boolean;
  payload?: LinkedInJobDetailsPayload;
  error?: string;
};

const shouldIncludeAdditionalSection = (section: LinkedInJobSection) => {
  const lower = section.heading.toLowerCase();
  if (
    lower.includes("responsibil") ||
    lower.includes("qualification") ||
    lower.includes("experience") ||
    lower.includes("contract") ||
    lower.includes("fraud") ||
    lower.includes("vacature")
  ) {
    return false;
  }
  const hasItems = Array.isArray(section.items) && section.items.length > 0;
  return hasItems || Boolean(section.content);
};

const buildManualJobArgs = (details: LinkedInJobDetailsPayload): ManualJobArgs => {
  const jobPayload: ManualJobArgs["job"] = {
    jobUrl: details.jobUrl,
    title: details.title ?? "Untitled role",
    company: details.companyName ?? "Unknown company",
    badges: details.badges ?? [],
    warnings: details.warnings ?? [],
    capturedAt: details.capturedAt,
    responsibilities: details.responsibilities ?? [],
    qualifications: details.qualifications ?? [],
    contractDetails: details.contractDetails ?? [],
  };

  if (details.jobId) jobPayload.linkedinJobId = details.jobId;
  if (details.canonicalUrl) jobPayload.linkedinCanonicalUrl = details.canonicalUrl;
  if (details.location) jobPayload.location = details.location;
  if (details.employmentType) jobPayload.employmentType = details.employmentType;
  if (details.workplaceType) jobPayload.workplaceType = details.workplaceType;
  if (details.postedAt) jobPayload.postedAt = details.postedAt;
  if (details.applicantsCount) jobPayload.applicantsCount = details.applicantsCount;
  if (details.companyUrl) jobPayload.companyUrl = details.companyUrl;
  if (details.companyLogo) jobPayload.companyLogo = details.companyLogo;
  if (details.companyIndustry) jobPayload.companyIndustry = details.companyIndustry;
  if (details.companySize) jobPayload.companySize = details.companySize;
  if (details.companyLinkedInCount) jobPayload.companyLinkedInCount = details.companyLinkedInCount;
  if (details.companyDescriptionHtml) jobPayload.companyDescriptionHtml = details.companyDescriptionHtml;
  if (details.companyDescriptionText) jobPayload.companyDescriptionText = details.companyDescriptionText;
  if (details.descriptionHtml) jobPayload.descriptionHtml = details.descriptionHtml;
  if (details.descriptionText) jobPayload.descriptionText = details.descriptionText;
  jobPayload.applyUrl = details.applyUrl ?? details.jobUrl;
  if (details.jobPoster) {
    const { name, title, profileUrl } = details.jobPoster;
    jobPayload.jobPoster = {
      name: name ?? undefined,
      title: title ?? undefined,
      profileUrl: profileUrl ?? undefined,
    };
  }
  // Removed rawHtml to reduce payload size (60-80KB -> 5-10KB)
  // rawHtml is only used for debugging and not required for functionality
  // if (details.rawHtml) jobPayload.rawHtml = details.rawHtml;

  jobPayload.additionalSections = (details.additionalSections ?? [])
    .filter(shouldIncludeAdditionalSection)
    .map((section) => ({
      heading: section.heading,
      content: section.content ?? undefined,
      items: section.items ?? undefined,
    }));

  return { job: jobPayload };
};

export function JobInsightPlaceholder({
  jobUrl: _jobUrl,
  jobId: _jobId,
  canonicalUrl: _canonicalUrl,
  existingJob,
  isLoading = false,
  onSavedAndScored,
}: JobInsightPlaceholderProps) {
  const isSaved = Boolean(existingJob);
  const jobIdentityKey = `${_jobId}::${_canonicalUrl ?? ""}::${_jobUrl}`;

  const [submissionStage, setSubmissionStage] = useState<"idle" | "saving" | "scoring">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showStreamingAI, setShowStreamingAI] = useState(true);
  const [selectedModel, setSelectedModel] = useState<"local" | "cloud">("local");
  const [isLocalAIAvailable, setIsLocalAIAvailable] = useState<boolean>(true); // Assume available initially
  const [LocalJobScoring, setLocalJobScoring] = useState<any>(null);
  const [CloudJobScoring, setCloudJobScoring] = useState<any>(null);

  // Streaming AI scoring state
  const [streamingScoreResult, setStreamingScoreResult] = useState<JobScoringResult | null>(null);
  const [streamingJobDetails, setStreamingJobDetails] = useState<LinkedInJobDetailsPayload | null>(null);
  const [isSavingStreamingScore, setIsSavingStreamingScore] = useState(false);
  const [rescoreTrigger, setRescoreTrigger] = useState(0); // Increment to trigger re-score
  const [currentJobKey, setCurrentJobKey] = useState(jobIdentityKey); // Track current job for change detection
  const [isCloudQuotaExceeded, setIsCloudQuotaExceeded] = useState(false);
  const [basicJobInfo, setBasicJobInfo] = useState<LinkedInBasicJobInfo | null>(null);
  const [streamingStatus, setStreamingStatus] = useState<"idle" | "initializing" | "streaming" | "error">("idle");

  const createManualJob = useMutation(api.jobScraping.createManualLinkedinJob);
  const scoreJobWithAI = useAction(api.jobScraping.scoreJobWithAI);

  // Get scoring context (user profile, interview summary, custom criteria, default criteria)
  const { userProfile, interviewSummary, customScoringCriteria, defaultScoringCriteria } = useScoringContext();

  // Load saved model preference from Chrome storage on mount
  useEffect(() => {
    getSelectedModel().then((savedModel) => {
      setSelectedModel(savedModel);
    });
  }, []);

  // Dynamically load local AI module
  useEffect(() => {
    import("../../local-ai")
      .then((module) => {
        setLocalJobScoring(() => module.LocalJobScoring);
      })
      .catch(() => {
        console.info("Local AI module not available");
      });

    import("../../cloud-ai")
      .then((module) => {
        setCloudJobScoring(() => module.CloudJobScoring);
      })
      .catch(() => {
        console.info("Cloud AI module not available");
      });
  }, []);

  // Fetch basic job info (title and company) on mount and when job changes
  useEffect(() => {
    // Fetch job info immediately without any delay or fade effect
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      chrome.runtime
        .sendMessage({ type: "REQUEST_LINKEDIN_JOB_TITLE_COMPANY" })
        .then((response: { success?: boolean; title?: string | null; company?: string | null; location?: string | null }) => {
          if (response?.success) {
            setBasicJobInfo({
              title: response.title ?? null,
              company: response.company ?? null,
              location: response.location ?? null,
            });
          }
        })
        .catch(() => {
          // Silent fail - not critical for functionality
          console.log("Could not fetch job title and company");
        });
    }
  }, [jobIdentityKey]);

  // Reset local scoring state when job URL changes
  useEffect(() => {
    if (jobIdentityKey !== currentJobKey) {
      // Job changed - reset all local scoring state to start fresh
      setStreamingScoreResult(null);
      setStreamingJobDetails(null);
      setShowStreamingAI(true);
      setStreamingStatus("idle");
      // Don't reset selectedModel - preserve user's saved preference across job changes
      setRescoreTrigger(0); // Reset trigger counter
      setCurrentJobKey(jobIdentityKey);
      setIsCloudQuotaExceeded(false);
      // Don't reset isInitialLoad - we only want no fade on the very first load
    }
  }, [jobIdentityKey, currentJobKey]);

  const isBusy = submissionStage !== "idle";
  const hasLocalAI = LocalJobScoring !== null;
  const hasCloudAI = CloudJobScoring !== null;
  const hasStreamingModel = hasLocalAI || hasCloudAI;

  // Handle local AI availability changes - auto-select cloud if local becomes unavailable
  const handleLocalAIAvailabilityChange = (available: boolean) => {
    setIsLocalAIAvailable(available);
    if (!available && hasCloudAI) {
      // Local AI not available, switch to cloud
      setSelectedModel("cloud");
    } else if (available) {
      // Local AI is available, prefer it
      setSelectedModel("local");
    }
  };

  useEffect(() => {
    if (!showStreamingAI) {
      return;
    }
    if (selectedModel === "local" && !hasLocalAI && hasCloudAI) {
      setSelectedModel("cloud");
    } else if (selectedModel === "cloud" && !hasCloudAI && hasLocalAI) {
      setSelectedModel("local");
    }
  }, [showStreamingAI, selectedModel, hasLocalAI, hasCloudAI]);

  const handleOpenDashboard = (jobDocId: string) => {
    if (typeof chrome === "undefined" || !chrome.tabs?.create) {
      return;
    }
    const url = new URL("https://applyfa.st/dashboard/jobs");
    url.searchParams.set("job", jobDocId);
    chrome.tabs.create({ url: url.toString() });
  };

  const handleOpenApplyUrl = (applyUrl: string) => {
    if (typeof chrome !== "undefined" && chrome.tabs?.create) {
      chrome.tabs.create({ url: applyUrl });
    }
  };

  const handleStreamingStatusChange = (status: "idle" | "initializing" | "streaming" | "error") => {
    setStreamingStatus(status);
  };

  const handleSaveAndScore = async () => {
    if (isBusy) {
      return;
    }

    setSubmissionStage("saving");
    setSaveError(null);

    try {
      const extractionResponse = (await chrome.runtime.sendMessage({
        type: "REQUEST_LINKEDIN_JOB_DETAILS",
      })) as CollectLinkedInResponse;

      if (!extractionResponse?.success || !extractionResponse.payload) {
        throw new Error(
          extractionResponse?.error ??
            "We couldn't read the LinkedIn job details. Scroll through the job description and try again."
        );
      }

      const args = buildManualJobArgs(extractionResponse.payload);
      const result = await createManualJob(args);

      setSubmissionStage("scoring");

      await scoreJobWithAI({ jobId: result.jobId });

      setSubmissionStage("idle");
      onSavedAndScored?.(result.jobId);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We couldn't save and score the job. Double-check the LinkedIn tab and try again.";
      setSaveError(message);
      setSubmissionStage("idle");
    }
  };

  const handleSaveStreamingScore = async () => {
    if (isSavingStreamingScore || !streamingScoreResult || !streamingJobDetails) {
      console.log("[JobInsightPlaceholder] Cannot save - missing data:", {
        isSavingStreamingScore,
        hasScoreResult: !!streamingScoreResult,
        hasJobDetails: !!streamingJobDetails,
      });
      return;
    }

    console.log("[JobInsightPlaceholder] Starting save with score:", streamingScoreResult);

    setIsSavingStreamingScore(true);
    setSaveError(null);

    try {
      const args = buildManualJobArgs(streamingJobDetails);

      // Add the local AI score to the job payload
      args.job.aiScore = streamingScoreResult.score;
      args.job.aiDescription = streamingScoreResult.description;
      args.job.aiRequirementChecks = streamingScoreResult.requirementChecks;

      console.log("[JobInsightPlaceholder] Calling createManualJob with args:", args);

      // Temporarily disabled skipExistingCheck until Convex deployment completes
      // TODO: Re-enable after Convex deployment: { ...args, skipExistingCheck: true }
      const result = await createManualJob(args);

      console.log("[JobInsightPlaceholder] Job saved successfully:", result);

      setIsSavingStreamingScore(false);
      onSavedAndScored?.(result.jobId);
    } catch (error) {
      console.error("[JobInsightPlaceholder] Error saving job:", error);
      const message =
        error instanceof Error
          ? error.message
          : "We couldn't save the job with the streamed score. Please try again.";
      setSaveError(message);
      setIsSavingStreamingScore(false);
    }
  };

  const handleRescore = () => {
    // Reset local scoring results and trigger immediate re-score
    setStreamingScoreResult(null);
    setStreamingJobDetails(null);
    setStreamingStatus("initializing");
    setRescoreTrigger((prev) => prev + 1); // Increment trigger to start scoring immediately
  };

  const handleCheckMatch = () => {
    // Trigger scoring with the selected model
    // If Local AI is not available, ensure Cloud is selected
    if (selectedModel === "local" && !isLocalAIAvailable && hasCloudAI) {
      setSelectedModel("cloud");
    }

    // Reset previous results and trigger scoring
    setStreamingScoreResult(null);
    setStreamingJobDetails(null);
    setStreamingStatus("initializing");
    setRescoreTrigger((prev) => prev + 1);
  };

  const isThinking = streamingStatus === "initializing";
  const baseButtonDisabled = !hasStreamingModel || (selectedModel === "cloud" && isCloudQuotaExceeded);
  const buttonDisabled = baseButtonDisabled || isThinking;
  const shouldShowMatchButton = rescoreTrigger === 0 || isThinking;
  const matchButtonTitle =
    selectedModel === "cloud" && isCloudQuotaExceeded
      ? "Cloud scoring limit reached for today"
      : isThinking
        ? "Analyzing job match..."
        : undefined;

  const unsavedSection = (
    <>
      {hasStreamingModel ? (
        <div className="flex flex-col h-full">
          {/* Ripple Wave Button - centered vertically and horizontally, hidden during scoring */}
          {shouldShowMatchButton && (
            <div className="relative flex items-center justify-center flex-1">
              <RippleWaveButton
                onClick={buttonDisabled ? undefined : handleCheckMatch}
                disabled={buttonDisabled}
                thinking={isThinking}
                title={matchButtonTitle}
                jobTitle={basicJobInfo?.title}
                company={basicJobInfo?.company}
                location={basicJobInfo?.location}
              />
            </div>
          )}

          {selectedModel === "local" && hasLocalAI && LocalJobScoring ? (
            <LocalJobScoring
              key={jobIdentityKey}
              userProfile={userProfile}
              interviewSummary={interviewSummary}
              scoringCriteria={customScoringCriteria}
              defaultScoringCriteria={defaultScoringCriteria}
              triggerRescore={rescoreTrigger}
              onAvailabilityChange={handleLocalAIAvailabilityChange}
              basicJobInfo={basicJobInfo}
              jobKey={jobIdentityKey}
              onStreamingStatusChange={handleStreamingStatusChange}
              onScoreComplete={(result: { score: number; description: string }, jobDetails: LinkedInJobDetailsPayload) => {
                console.log("Local AI score complete:", result);
                setStreamingScoreResult(result);
                setStreamingJobDetails(jobDetails);
                setStreamingStatus("streaming");
              }}
            />
          ) : null}

          {selectedModel === "cloud" && hasCloudAI && CloudJobScoring ? (
            <CloudJobScoring
              key={jobIdentityKey}
              triggerRescore={rescoreTrigger}
              onQuotaExceededChange={setIsCloudQuotaExceeded}
              basicJobInfo={basicJobInfo}
              jobKey={jobIdentityKey}
              onStreamingStatusChange={handleStreamingStatusChange}
              onScoreComplete={(result: { score: number; description: string }, jobDetails: LinkedInJobDetailsPayload) => {
                console.log("Cloud AI score complete:", result);
                setStreamingScoreResult(result);
                setStreamingJobDetails(jobDetails);
                setStreamingStatus("streaming");
              }}
            />
          ) : null}

          {selectedModel === "local" && !hasLocalAI ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Local scoring isn't available on this browser. Choose the cloud model instead.
            </p>
          ) : null}

          {selectedModel === "cloud" && !hasCloudAI ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Cloud scoring isn't available right now. Try the local model instead.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-background/40 p-4 text-sm leading-relaxed text-muted-foreground">
          <p>Click "Check Match" to analyze this LinkedIn job and generate a personalized fit score.</p>
          <p className="mt-3 text-xs text-muted-foreground">
            Tip: scroll through the LinkedIn job description once before checking so all of the content is loaded.
          </p>
        </div>
      )}
    </>
  );

  const savedSection = existingJob ? (
    <div className="space-y-4" style={{ paddingBottom: "24px" }}>
      {/* Job Info Header card */}
      <div className="rounded-xl border bg-card text-card-foreground p-4 shadow-none">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <h3 className="font-semibold text-base leading-tight mb-2">
                {existingJob.title}
              </h3>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate font-medium">{existingJob.company}</span>
              </div>
              {existingJob.location && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground" style={{ marginTop: "0.25rem" }}>
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate font-medium">{existingJob.location}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              {typeof existingJob.aiScore === "number" ? (
                <ScoreChart score={existingJob.aiScore} size="lg" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
                  --
                </div>
              )}
            </div>
          </div>

          {typeof existingJob.aiScore === "number" && (() => {
            const metRequirementsCount = existingJob.aiRequirementChecks?.filter(c => c.score === 1).length || 0;
            const score = existingJob.aiScore;

            // Determine color scheme based on score
            let bgColor, textColor, iconColor, secondaryTextColor, borderColor;
            if (score >= 7) {
              // Green for good fit
              bgColor = "bg-green-50 dark:bg-green-950/30";
              textColor = "text-green-900 dark:text-green-100";
              iconColor = "text-green-600 dark:text-green-400";
              secondaryTextColor = "text-green-700 dark:text-green-300";
              borderColor = "border-green-200 dark:border-green-800";
            } else if (score >= 5) {
              // Yellow for moderate fit
              bgColor = "bg-yellow-50 dark:bg-yellow-950/30";
              textColor = "text-yellow-900 dark:text-yellow-100";
              iconColor = "text-yellow-600 dark:text-yellow-400";
              secondaryTextColor = "text-yellow-700 dark:text-yellow-300";
              borderColor = "border-yellow-200 dark:border-yellow-800";
            } else {
              // Red for bad fit
              bgColor = "bg-red-50 dark:bg-red-950/30";
              textColor = "text-red-900 dark:text-red-100";
              iconColor = "text-red-600 dark:text-red-400";
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
       existingJob.aiRequirementChecks &&
       existingJob.aiRequirementChecks.length > 0 && (
        <div className="rounded-xl border bg-card text-card-foreground p-4 shadow-none">
          <h3 className="text-base font-semibold mb-3">Your Requirements</h3>
          <div className="space-y-2">
            {userProfile.roleRequirements.map((requirement, idx) => {
              const check = existingJob.aiRequirementChecks?.find(c => c.requirement === requirement);
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
      <div className="rounded-xl border bg-card text-card-foreground p-4 shadow-none">
        <h3 className="text-base font-semibold mb-3">Explanation</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {existingJob.aiDescription ??
            "We're generating tailored insights for this role. Check back soon for a detailed analysis."}
        </p>
      </div>
    </div>
  ) : null;

  const feedbackSection = (
    <>
      {submissionStage === "saving" ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Saving job details to ApplyFast…
        </div>
      ) : null}
      {submissionStage === "scoring" ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Scoring this job based on your profile…
        </div>
      ) : null}
      {saveError ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          {saveError}
        </div>
      ) : null}
    </>
  );

  const footerContent = (() => {
    if (isLoading) {
      return null;
    }

    // State 1: Job is saved - show "Open in ApplyFast" + "Apply Directly"
    if (isSaved && existingJob) {
      return (
        <div className="flex w-full flex-row gap-2">
          <Button
            className="flex h-[42px] flex-1 items-center justify-center gap-2 rounded-md"
            onClick={() => handleOpenDashboard(existingJob._id)}
          >
            Open in ApplyFast
          </Button>
          {existingJob.applyUrl ? (
            <Button
              variant="outline"
              className="flex h-[42px] flex-1 items-center justify-center gap-2 rounded-md"
              onClick={() => handleOpenApplyUrl(existingJob.applyUrl!)}
            >
              Apply Directly
            </Button>
          ) : null}
        </div>
      );
    }

    // State 2: Job scored locally - show "Save Job" + "Re-score"
    if (streamingScoreResult && streamingJobDetails) {
      return (
        <div className="flex w-full flex-row gap-2">
          <Button
            className="flex h-[42px] flex-1 items-center justify-center gap-2 rounded-md"
            onClick={handleSaveStreamingScore}
            disabled={isSavingStreamingScore}
          >
            {isSavingStreamingScore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Bookmark className="h-4 w-4" />
                Save Job
              </>
            )}
          </Button>
          <Button
            variant="outline"
            className="flex h-[42px] flex-1 items-center justify-center gap-2 rounded-md"
            onClick={handleRescore}
            disabled={isSavingStreamingScore}
          >
            <RefreshCw className="h-4 w-4" />
            Re-score
          </Button>
        </div>
      );
    }

    // State 3: Default - show model selector in footer
    if (hasStreamingModel) {
      return (
        <Select
          value={selectedModel}
          onValueChange={(value) => {
            const typedValue = value as "local" | "cloud";
            setSelectedModel(typedValue);
            saveSelectedModel(typedValue); // Persist to Chrome storage
            setStreamingScoreResult(null);
            setStreamingJobDetails(null);
            setRescoreTrigger(0);
            setStreamingStatus("idle");
          }}
        >
          <SelectTrigger className="h-[42px] w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="local" disabled={!hasLocalAI || !isLocalAIAvailable}>
              <div className="flex items-center w-full pr-8 gap-3">
                <span className="flex-1">{MODEL_CONFIGS.local.name} ({MODEL_CONFIGS.local.description})</span>
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100 text-xs px-2 py-0.5 rounded-full shrink-0"
                >
                  {MODEL_CONFIGS.local.costDescription}
                </Badge>
              </div>
            </SelectItem>
            <SelectItem value="cloud" disabled={!hasCloudAI}>
              <div className="flex items-center w-full pr-8 gap-3">
                <span className="flex-1">{MODEL_CONFIGS.cloud.name} ({MODEL_CONFIGS.cloud.description})</span>
                <Badge
                  variant="secondary"
                  className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100 text-xs px-2 py-0.5 rounded-full shrink-0"
                >
                  {MODEL_CONFIGS.cloud.costDescription}
                </Badge>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      );
    }

    return null;
  })();

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex-1 overflow-y-auto bg-background px-4">
        <div
          className={`flex h-full flex-col${isLoading ? "" : " pt-4 pb-20"}`}
          aria-label="Job insight view"
        >
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {isSaved ? savedSection : unsavedSection}
              {feedbackSection}
            </>
          )}
        </div>
      </div>

      {footerContent && (
        <div className="sticky bottom-0 border-t border-border bg-[#FAFAFA] p-4 dark:bg-background/95 backdrop-blur">
          {footerContent}
        </div>
      )}
    </div>
  );
}
