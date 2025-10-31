"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import RequirementsChecker from "./RequirementsChecker";
import { ScoreChart } from "./ScoreChart";
import { useToast } from "@/hooks/use-toast";
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
import { Button } from "@/components/ui/button";

interface JobDetailsModalProps {
  jobId: Id<"jobs"> | null;
  onClose: () => void;
}

export default function JobDetailsModal({
  jobId,
  onClose
}: JobDetailsModalProps) {
  const job = useQuery(api.jobScraping.getJobById, jobId ? { jobId } : "skip");
  const scrape = useQuery(
    api.jobScraping.getJobScrape,
    job ? { scrapeId: job.scrapeId } : "skip"
  );
  const userProfile = useQuery(api.userProfiles.getUserProfile);

  // State and mutation for delete functionality
  const [deletingId, setDeletingId] = useState<Id<"jobs"> | null>(null);
  const deleteJob = useMutation(api.jobScraping.deleteJob);
  const { toast } = useToast();

  // Handler for delete confirmation
  const confirmDelete = async () => {
    if (!deletingId) return;

    try {
      await deleteJob({ jobId: deletingId });
      toast({
        title: "Job deleted",
        description: "Job has been deleted successfully.",
      });
      onClose(); // Close the modal after successful deletion
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to delete job: ${error}`,
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (jobId) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [jobId]);

  if (!jobId || !job) {
    return null;
  }

  const formatDescription = (description: string | undefined) => {
    if (!description) return "No description available.";

    // Enhanced formatting for better readability
    const formatted = description
      // Clean up excessive whitespace but preserve intentional spacing
      .replace(/\s+/g, ' ')
      .trim()
      // Clean up any HTML entities first
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');

    // Split into sentences for better paragraph detection
    const sentences = formatted.split(/\.\s+/);
    let result = '';
    let currentParagraph = '';

    for (let i = 0; i < sentences.length; i++) {
      let sentence = sentences[i].trim();
      if (!sentence) continue;

      // Add period back (except for last sentence which might not need one)
      if (i < sentences.length - 1 && !sentence.match(/[.!?]$/)) {
        sentence += '.';
      }

      // Detect section headers and important breaks
      const isHeader = (
        // All caps words with colons
        sentence.match(/^[A-Z][A-Z\s]{8,}:/) ||
        // Common job section headers
        sentence.match(/^(About|Overview|Summary|Description|Responsibilities|Requirements|Qualifications|Experience|Skills|Benefits|Company|Role|Position|Job|What you'll do|What we offer|We are looking for|The ideal candidate)/i) ||
        // Short sentences that look like headers
        (sentence.length < 50 && sentence.match(/^[A-Za-z\s]{3,}:$/)) ||
        // Numbered sections
        sentence.match(/^\d+\.\s*[A-Za-z]/)
      );

      // Detect bullet points
      const isBulletPoint = sentence.match(/^[•\-\*o]\s/) || sentence.match(/^[\-\•]\s/);

      // If we hit a header or have accumulated enough content, end current paragraph
      if (isHeader || currentParagraph.length > 300) {
        if (currentParagraph.trim()) {
          result += `<p>${currentParagraph.trim()}</p>\n`;
          currentParagraph = '';
        }
      }

      // Format the sentence
      if (isHeader) {
        // Add headers without bold formatting to avoid line breaks
        result += `<p class="mt-4 mb-2">${sentence}</p>\n`;
      } else if (isBulletPoint) {
        // Format bullet points with proper indentation
        const bulletText = sentence
          .replace(/^[•\-\*o]\s*/, '• ')
          .replace(/^[\-\•]\s*/, '• ');
        result += `<p class="ml-4 mb-1">${bulletText}</p>\n`;
      } else {
        // Regular sentence - add to current paragraph
        currentParagraph += (currentParagraph ? ' ' : '') + sentence;
      }
    }

    // Add any remaining paragraph content
    if (currentParagraph.trim()) {
      result += `<p>${currentParagraph.trim()}</p>\n`;
    }

    // Post-process to clean up and enhance formatting
    result = result
      // Fix common formatting issues
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      // Format numbered lists without bold
      .replace(/(\d+)\.\s*([A-Za-z])/g, '$1. $2')
      // Format email addresses and URLs (basic)
      .replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '<a href="mailto:$1" class="text-gray-600 dark:text-gray-400 underline">$1</a>')
      // Add spacing around common section breaks (without bold formatting)
      .replace(/(Responsibilities|Requirements|Qualifications|Benefits|About\s+(?:the\s+)?(?:Role|Position|Company)|What\s+we\s+offer):/gi, '<br>$1:')
      .trim();

    // If no formatting was applied (very short or unusual format), just return basic paragraph
    if (!result || result.length < 20) {
      return `<p>${formatted}</p>`;
    }

    return result;
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "Unknown";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {job.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {job.company}
                </span>
                {job.location && (
                  <span className="flex items-center">
                    {job.location}
                  </span>
                )}
                {job.salary && (
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded text-xs font-medium">
                    {job.salary}
                  </span>
                )}
              </div>

            </div>

            {/* Score Chart */}
            {job.aiScore && (
              <div className="flex items-center justify-center ml-4">
                <ScoreChart score={job.aiScore} size="lg" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              {/* Role Requirements Validation - only show when actually scored */}
              {userProfile?.roleRequirements && 
               userProfile.roleRequirements.length > 0 && 
               job.aiRequirementChecks && 
               job.aiRequirementChecks.length > 0 && (
                <RequirementsChecker
                  requirements={userProfile.roleRequirements}
                  checks={job.aiRequirementChecks}
                />
              )}

              {/* AI Score Analysis - shown at top if available */}
              {job.aiScore && job.aiDescription && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Analysis
                  </h2>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
                      {job.aiDescription}
                    </p>
                    {job.aiScoredAt && (
                      <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                        Analyzed {new Date(job.aiScoredAt).toLocaleDateString()} at{' '}
                        {new Date(job.aiScoredAt).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Job details summary */}
              <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-3">
                      Job Details
                    </h3>
                    <dl className="space-y-2 text-sm">
                      {job.experienceLevel && (
                        <>
                          <dt className="font-medium text-gray-600 dark:text-gray-400">Experience Level</dt>
                          <dd className="text-gray-900 dark:text-gray-100">{job.experienceLevel}</dd>
                        </>
                      )}
                      {job.industry && (
                        <>
                          <dt className="font-medium text-gray-600 dark:text-gray-400">Industry</dt>
                          <dd className="text-gray-900 dark:text-gray-100">{job.industry}</dd>
                        </>
                      )}
                      {job.postedDate && (
                        <>
                          <dt className="font-medium text-gray-600 dark:text-gray-400">Posted Date</dt>
                          <dd className="text-gray-900 dark:text-gray-100">{formatDate(job.postedDate)}</dd>
                        </>
                      )}
                    </dl>
                  </div>

                  <div>
                    <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-3">
                      Company Information
                    </h3>
                    <dl className="space-y-2 text-sm">
                      <dt className="font-medium text-gray-600 dark:text-gray-400">Company</dt>
                      <dd className="text-gray-900 dark:text-gray-100">{job.company}</dd>
                      {job.companySize && (
                        <>
                          <dt className="font-medium text-gray-600 dark:text-gray-400">Company Size</dt>
                          <dd className="text-gray-900 dark:text-gray-100">{job.companySize}</dd>
                        </>
                      )}
                      {scrape && (
                        <>
                          <dt className="font-medium text-gray-600 dark:text-gray-400">Source Scrape</dt>
                          <dd className="text-gray-900 dark:text-gray-100">{scrape.name}</dd>
                        </>
                      )}
                    </dl>
                  </div>
                </div>
              </div>

              {/* Job Description */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Job Description
                </h2>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div
                    className="prose prose-sm max-w-none text-gray-800 dark:text-gray-200 leading-relaxed"
                    style={{
                      fontFamily: 'inherit',
                      lineHeight: '1.7',
                      fontSize: '14px',
                    }}
                    dangerouslySetInnerHTML={{
                      __html: `<div style="
                        word-wrap: break-word;
                        white-space: pre-wrap;
                      ">${formatDescription(job.description)}</div>`
                    }}
                  />
                </div>
                {/* Show character count for long descriptions */}
                {job.description && job.description.length > 500 && (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {job.description.length.toLocaleString()} characters
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-800 rounded-b-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-3">
                {job.url && (
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-3 text-xs"
                  >
                    Show on LinkedIn
                  </a>
                )}
                {job.applyUrl && job.applyUrl !== job.url && (
                  <a
                    href={job.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-3 text-xs"
                  >
                    Company Website
                  </a>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeletingId(jobId)}
                >
                  Delete Job
                </Button>
              </div>
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-3 text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete job?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this job from your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
