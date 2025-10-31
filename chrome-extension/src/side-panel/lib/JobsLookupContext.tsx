import React, { createContext, useContext, useMemo } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Doc } from "../../../../convex/_generated/dataModel";

interface JobsLookupContextValue {
  findJobByIdentifiers: (
    linkedinJobId?: string,
    canonicalUrl?: string
  ) => Doc<"jobs"> | null;
  jobs: Doc<"jobs">[] | undefined;
  isLoading: boolean;
}

const JobsLookupContext = createContext<JobsLookupContextValue | null>(null);

interface JobsLookupProviderProps {
  children: React.ReactNode;
}

/**
 * Provider that maintains a client-side lookup cache of all user's jobs.
 * Uses Convex reactive subscriptions to keep data fresh automatically.
 *
 * This enables instant O(1) lookups without additional network calls,
 * following Convex best practices of leveraging reactive queries.
 */
export function JobsLookupProvider({ children }: JobsLookupProviderProps) {
  const { isAuthenticated } = useConvexAuth();

  // Skip query when not authenticated to prevent errors
  const jobs = useQuery(
    api.jobScraping.searchJobs,
    isAuthenticated ? { keywords: undefined } : "skip"
  );

  // Create lookup maps for efficient O(1) lookups
  const lookupMaps = useMemo(() => {
    if (!jobs) {
      return {
        byLinkedInJobId: new Map<string, Doc<"jobs">>(),
        byCanonicalUrl: new Map<string, Doc<"jobs">>(),
      };
    }

    const byLinkedInJobId = new Map<string, Doc<"jobs">>();
    const byCanonicalUrl = new Map<string, Doc<"jobs">>();

    for (const job of jobs) {
      if (job.linkedinJobId) {
        byLinkedInJobId.set(job.linkedinJobId, job);
      }
      if (job.linkedinCanonicalUrl) {
        byCanonicalUrl.set(job.linkedinCanonicalUrl, job);
      }
    }

    return { byLinkedInJobId, byCanonicalUrl };
  }, [jobs]);

  const findJobByIdentifiers = (
    linkedinJobId?: string,
    canonicalUrl?: string
  ): Doc<"jobs"> | null => {
    // Try LinkedIn Job ID first (most specific)
    if (linkedinJobId) {
      const jobById = lookupMaps.byLinkedInJobId.get(linkedinJobId);
      if (jobById) return jobById;
    }

    // Fall back to canonical URL
    if (canonicalUrl) {
      const jobByUrl = lookupMaps.byCanonicalUrl.get(canonicalUrl);
      if (jobByUrl) return jobByUrl;
    }

    return null;
  };

  const value: JobsLookupContextValue = {
    findJobByIdentifiers,
    jobs,
    isLoading: isAuthenticated && jobs === undefined,
  };

  return (
    <JobsLookupContext.Provider value={value}>
      {children}
    </JobsLookupContext.Provider>
  );
}

/**
 * Hook to access the jobs lookup cache.
 * Provides instant lookups without additional Convex calls.
 */
export function useJobsLookup() {
  const context = useContext(JobsLookupContext);
  if (!context) {
    throw new Error("useJobsLookup must be used within JobsLookupProvider");
  }
  return context;
}
