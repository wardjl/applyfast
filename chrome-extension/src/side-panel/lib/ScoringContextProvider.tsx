import React, { createContext, useContext } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Doc } from "../../../../convex/_generated/dataModel";

interface ScoringContextValue {
  userProfile: Doc<"userProfiles"> | null;
  interviewSummary: string | null;
  customScoringCriteria: string | null;
  defaultScoringCriteria: string | null;
  isLoading: boolean;
}

const ScoringContext = createContext<ScoringContextValue | null>(null);

interface ScoringContextProviderProps {
  children: React.ReactNode;
}

/**
 * Provider that maintains scoring context (user profile, interview summary, custom criteria).
 * Uses Convex reactive subscriptions to keep data fresh automatically.
 *
 * This enables the extension to load all scoring data once when it opens,
 * following the same architecture pattern as JobsLookupProvider.
 */
export function ScoringContextProvider({ children }: ScoringContextProviderProps) {
  const { isAuthenticated } = useConvexAuth();
  
  // Skip query when not authenticated to prevent errors
  const scoringData = useQuery(
    api.userProfiles.getScoringContext,
    isAuthenticated ? {} : "skip"
  );

  const value: ScoringContextValue = {
    userProfile: scoringData?.userProfile ?? null,
    interviewSummary: scoringData?.interviewSummary ?? null,
    customScoringCriteria: scoringData?.customScoringCriteria ?? null,
    defaultScoringCriteria: scoringData?.defaultScoringCriteria ?? null,
    isLoading: scoringData === undefined,
  };

  return (
    <ScoringContext.Provider value={value}>
      {children}
    </ScoringContext.Provider>
  );
}

/**
 * Hook to access the scoring context.
 * Provides user profile, interview summary, and custom scoring criteria.
 */
export function useScoringContext() {
  const context = useContext(ScoringContext);
  if (!context) {
    throw new Error("useScoringContext must be used within ScoringContextProvider");
  }
  return context;
}
