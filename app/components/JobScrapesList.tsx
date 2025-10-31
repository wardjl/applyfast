"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function JobScrapesList() {
  const router = useRouter();
  const jobScrapes = useQuery(api.jobScraping.listJobScrapes);
  const visibleJobScrapes = jobScrapes?.filter((scrape) => !scrape.isManual);
  const deleteJobScrape = useMutation(api.jobScraping.deleteJobScrape);
  const resumeScoring = useMutation(api.jobScraping.resumeScoring);
  const dailyUsage = useQuery(api.aiUsageTracking.getDailyAiUsage);
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<Id<"jobScrapes"> | null>(null);

  const confirmDelete = async () => {
    if (!deletingId) return;

    try {
      await deleteJobScrape({ scrapeId: deletingId });
      toast({
        title: "Search deleted",
        description: "Job search and all its jobs have been deleted successfully.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to delete job search: ${error}`,
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleResumeScoring = async (id: Id<"jobScrapes">) => {
    try {
      await resumeScoring({ scrapeId: id });
      toast({
        title: "Scoring resumed",
        description: "AI scoring has been resumed for this scrape.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to resume scoring: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  };

  const handleViewJobs = (scrapeId: Id<"jobScrapes">) => {
    // Navigate to job search route with scrape filter
    const targetId = String(scrapeId);
    router.push(`/dashboard/jobs?scrape=${encodeURIComponent(targetId)}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200";
      case "running":
        return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
      case "scoring":
        return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
      case "scoring_paused":
        return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
      case "pending":
        return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
      case "failed":
        return "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "scoring_paused":
        return "Scoring Paused";
      case "running":
        return "Processing";
      case "scoring":
        return "Scoring";
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getScoringProgress = (scrape: { totalJobsToScore?: number; jobsScored?: number }) => {
    if (scrape.totalJobsToScore && scrape.jobsScored !== undefined) {
      const percentage = Math.round((scrape.jobsScored / scrape.totalJobsToScore) * 100);
      return {
        percentage,
        text: `${scrape.jobsScored}/${scrape.totalJobsToScore} unique jobs scored`,
      };
    }
    return null;
  };

  const extractSearchTerms = (linkedinUrl: string) => {
    try {
      const url = new URL(linkedinUrl);
      const keywords = url.searchParams.get('keywords');
      const location = url.searchParams.get('location');
      const timeFrame = url.searchParams.get('f_TPR');
      
      let searchTerms = keywords || url.searchParams.get('title') || 'Custom search';
      
      // Add location if available
      if (location) {
        searchTerms += ` in ${location}`;
      }
      
      // Add time frame if available
      if (timeFrame) {
        const timeFrameMap: Record<string, string> = {
          'r86400': 'Past 24 hours',
          'r604800': 'Past week',
          'r2592000': 'Past month',
          'r7776000': 'Past 3 months',
          'r31536000': 'Past year'
        };
        const timeFrameText = timeFrameMap[timeFrame] || `Past ${timeFrame} days`;
        searchTerms += ` (${timeFrameText})`;
      }
      
      return searchTerms;
    } catch {
      return 'Custom search';
    }
  };

  if (jobScrapes === undefined) {
    return <div>Loading job searches...</div>;
  }

  if (!visibleJobScrapes || visibleJobScrapes.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center bg-transparent">
        <div className="flex w-full max-w-3xl flex-col items-center justify-center gap-3 rounded-lg p-10 text-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            No Job Searches Yet
          </h3>
          <p className="max-w-xl text-gray-500 dark:text-gray-400">
            Start by creating your first LinkedIn job search to find relevant positions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete job search?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this job search and all its associated jobs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-10rem)]">
        {visibleJobScrapes.map((scrape) => (
        <div key={scrape._id} className="border rounded-lg p-4 bg-white dark:bg-gray-800 hover:shadow-sm transition-shadow">
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{scrape.name}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Search: &ldquo;{scrape.linkedinUrl ? extractSearchTerms(scrape.linkedinUrl) : (scrape.searchQuery || 'Custom search')}&rdquo;
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(scrape.status === "running" || scrape.status === "scoring") ? (
                <Badge className={`${getStatusColor(scrape.status)} pl-1.5 shadow-none hover:${getStatusColor(scrape.status)} rounded-full text-xs font-medium`}>
                  <Spinner className="mr-1" />
                  {getStatusText(scrape.status)}
                </Badge>
              ) : (
                <Badge className={`${getStatusColor(scrape.status)} shadow-none hover:${getStatusColor(scrape.status)} rounded-full text-xs font-medium`}>
                  {getStatusText(scrape.status)}
                </Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm mb-3">
            <div>
              <span className="font-medium">Created:</span> {formatDate(scrape.createdAt)}
            </div>
            {scrape.completedAt && (
              <div>
                <span className="font-medium">Completed:</span> {formatDate(scrape.completedAt)}
              </div>
            )}
            {scrape.totalJobs !== undefined && (
              <div>
                <span className="font-medium">Jobs Found:</span> {scrape.totalJobs}
              </div>
            )}
            {scrape.apifyRunId && (
              <div>
                <span className="font-medium">Apify Run:</span>
                <code className="ml-1 text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">
                  {scrape.apifyRunId.substring(0, 8)}...
                </code>
              </div>
            )}
          </div>

          {scrape.errorMessage && (
            <div className="bg-gray-100 dark:bg-gray-800/20 border border-gray-300 dark:border-gray-700 rounded p-3 mb-3">
              <p className="text-gray-800 dark:text-gray-200 text-sm">
                <strong>Error:</strong> {scrape.errorMessage}
              </p>
            </div>
          )}

          <div className="pt-3 border-t space-y-3">
            <div className="text-sm text-gray-500">
              {scrape.status === "running" && (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-aquamarine-600 mr-2"></div>
                  Search in progress...
                </span>
              )}
              {scrape.status === "pending" && "Waiting to start..."}
              {scrape.status === "scoring" && (
                <div className="space-y-2">
                  <span>AI scoring all unscored jobs...</span>
                  {(() => {
                    const progress = getScoringProgress(scrape);
                    if (progress) {
                      return (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>{progress.text}</span>
                            <span>{progress.percentage}%</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-black h-2 rounded-full transition-all duration-300 dark:bg-white"
                              style={{ width: `${progress.percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
              {scrape.status === "scoring_paused" && (
                <div className="space-y-2">
                  {scrape.totalJobs === 0 ? (
                    <span>No jobs found to score</span>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                        <span>AI scoring paused (usage limits reached)</span>
                      </div>
                      {(() => {
                        const progress = getScoringProgress(scrape);
                        if (progress) {
                          return (
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span>{progress.text}</span>
                                <span>{progress.percentage}%</span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-gray-500 h-2 rounded-full transition-all duration-300 dark:bg-gray-400"
                                  style={{ width: `${progress.percentage}%` }}
                                ></div>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-2 w-full"
                                onClick={() => handleResumeScoring(scrape._id)}
                                disabled={!dailyUsage || dailyUsage.remainingScores <= 0}
                              >
                                {!dailyUsage || dailyUsage.remainingScores <= 0
                                  ? "No AI calls remaining today"
                                  : "Resume AI Scoring"}
                              </Button>
                            </div>
                          );
                        }
                        return (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2 w-full"
                            onClick={() => handleResumeScoring(scrape._id)}
                            disabled={!dailyUsage || dailyUsage.remainingScores <= 0}
                          >
                            {!dailyUsage || dailyUsage.remainingScores <= 0
                              ? "No AI calls remaining today"
                              : "Resume AI Scoring"}
                          </Button>
                        );
                      })()}
                    </>
                  )}
                </div>
              )}
              {scrape.status === "completed" && `Completed with ${scrape.totalJobs} jobs`}
              {scrape.status === "failed" && "Search failed"}
            </div>

            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                {(scrape.status === "completed" || scrape.status === "scoring" || scrape.status === "scoring_paused") && scrape.totalJobs !== undefined && scrape.totalJobs > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewJobs(scrape._id)}
                  >
                    View {scrape.totalJobs} Jobs
                    {scrape.status === "scoring" && " (scoring in progress)"}
                    {scrape.status === "scoring_paused" && " (scoring paused)"}
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => setDeletingId(scrape._id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}
      </div>
    </>
  );
}
