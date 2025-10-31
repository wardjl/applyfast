"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";

export function DashboardShell({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const pathname = usePathname();
  const router = useRouter();

  const interviewState = useQuery(
    api.jobPreferenceInterviews.getInterviewState,
    isAuthenticated ? {} : undefined,
  );

  useEffect(() => {
    if (!isAuthenticated || !interviewState) {
      return;
    }

    const needsOnboarding = !interviewState.jobPreferencesFilled || !interviewState.linkedinProfileAvailable;
    if (needsOnboarding) {
      router.replace("/onboarding");
    }
  }, [interviewState, isAuthenticated, router]);

  // Remove padding for jobs page to allow table to integrate seamlessly
  const isJobsPage = pathname === "/dashboard/jobs";

  if (isLoading || (isAuthenticated && !interviewState)) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Skeleton className="h-32 w-full max-w-3xl" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={`flex flex-1 flex-col min-h-0 ${isJobsPage ? "" : "gap-10 p-4 lg:p-6"}`}>
      {children}
    </div>
  );
}
