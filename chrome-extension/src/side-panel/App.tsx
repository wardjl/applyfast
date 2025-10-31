import { useConvexAuth } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { LoginForm } from "./components/LoginForm";
import { JobSearchPage } from "./components/JobSearchPage";
import { SavedJobsPage } from "./components/SavedJobsPage";
import { ProfilePage } from "./components/ProfilePage";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { JobInsightPlaceholder } from "./components/JobInsightPlaceholder";
import { useJobsLookup } from "./lib/JobsLookupContext";

type Page = "saved-jobs" | "job-search" | "profile";
type ActiveJob = { jobId: string; jobUrl: string; canonicalUrl?: string };

export function App() {
  const { isAuthenticated } = useConvexAuth();
  const [currentPage, setCurrentPage] = useState<Page>("job-search");
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [showJobInsight, setShowJobInsight] = useState(false);

  // Establish persistent connection with background to track panel state
  useEffect(() => {
    let isUnmounted = false;
    let reconnectTimeoutId: number | undefined;
    let port: chrome.runtime.Port | null = null;

    const notifyOpened = () => {
      chrome.runtime.sendMessage({ type: "SIDE_PANEL_OPENED" }).catch(() => {
        // Background worker might be restarting; ignore and rely on reconnect.
      });
    };

    const notifyClosed = () => {
      chrome.runtime.sendMessage({ type: "SIDE_PANEL_CLOSED" }).catch(() => {
        // Ignore errors when background isn't ready.
      });
    };

    function scheduleReconnect() {
      if (isUnmounted || reconnectTimeoutId !== undefined) {
        return;
      }

      reconnectTimeoutId = window.setTimeout(() => {
        reconnectTimeoutId = undefined;
        establishConnection();
      }, 500);
    }

    function establishConnection() {
      if (isUnmounted) {
        return;
      }

      try {
        port = chrome.runtime.connect({ name: "side-panel" });
      } catch {
        scheduleReconnect();
        return;
      }

      notifyOpened();

      port.onDisconnect.addListener(() => {
        port = null;
        if (isUnmounted) {
          return;
        }
        scheduleReconnect();
      });
    }

    const handleBeforeUnload = () => {
      if (isUnmounted) {
        return;
      }
      notifyClosed();
    };

    establishConnection();
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Cleanup on unmount
    return () => {
      isUnmounted = true;
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (reconnectTimeoutId !== undefined) {
        window.clearTimeout(reconnectTimeoutId);
      }
      notifyClosed();
      port?.disconnect();
    };
  }, []);

  // Listen for sign-out messages from background script
  useEffect(() => {
    const handleMessage = (message: {
      type: string;
      jobId?: string;
      jobUrl?: string;
      canonicalUrl?: string;
    }) => {
      switch (message.type) {
        case "SIGNED_OUT": {
          // Reload the page to trigger re-authentication check
          window.location.reload();
          break;
        }
        case "LINKEDIN_JOB_DETECTED": {
          const { jobId, jobUrl, canonicalUrl } = message;

          if (jobId && jobUrl) {
            setActiveJob((previous) => {
              // Check if it's the same job
              if (
                previous &&
                previous.jobId === jobId &&
                previous.jobUrl === jobUrl &&
                previous.canonicalUrl === canonicalUrl
              ) {
                return previous;
              }

              return { jobId, jobUrl, canonicalUrl: canonicalUrl ?? previous?.canonicalUrl };
            });
            // Always show job insight when a LinkedIn job is detected
            // This ensures the view switches even if the job data hasn't changed
            setShowJobInsight(true);
          }
          break;
        }
        case "LINKEDIN_JOB_CLEARED": {
          setActiveJob(null);
          setShowJobInsight(false);
          break;
        }
        default:
          break;
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  // Use client-side lookup cache to find jobs without additional Convex calls
  const { findJobByIdentifiers, isLoading: isJobsLoading } = useJobsLookup();

  const displayJobInsight = Boolean(activeJob && showJobInsight);

  // Perform instant O(1) lookup in already-loaded jobs cache
  const jobInsightResult = displayJobInsight && activeJob
    ? findJobByIdentifiers(activeJob.jobId, activeJob.canonicalUrl)
    : null;

  const isInsightLoading = displayJobInsight && isJobsLoading;
  const resolvedInsight = jobInsightResult;

  const handleSavedAndScored = useCallback((_jobDocId: string) => {
    // Stay on the review view; data will refresh via the Convex query
    setShowJobInsight(true);
  }, []);

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  const handleNavigate = (page: Page) => {
    setShowJobInsight(false);
    setCurrentPage(page);
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Fixed Header */}
      <Header
        currentPage={currentPage}
        onNavigate={handleNavigate}
        hasActiveJob={displayJobInsight}
      />

      {/* Main Content - Keep all views mounted to preserve Convex subscriptions */}
      <main className="flex-1 overflow-hidden pt-[65px]">
        {/* Job Insight View */}
        {activeJob && (
          <div className={displayJobInsight ? "h-full" : "hidden"}>
            <JobInsightPlaceholder
              jobUrl={activeJob.jobUrl}
              jobId={activeJob.jobId}
              existingJob={resolvedInsight}
              isLoading={isInsightLoading}
              canonicalUrl={activeJob.canonicalUrl}
              onSavedAndScored={handleSavedAndScored}
            />
          </div>
        )}

        {/* Page Views - Keep all mounted, control visibility */}
        <div className={displayJobInsight || currentPage !== "job-search" ? "hidden" : "h-full"}>
          <JobSearchPage />
        </div>
        <div className={displayJobInsight || currentPage !== "saved-jobs" ? "hidden" : "h-full"}>
          <SavedJobsPage />
        </div>
        <div className={displayJobInsight || currentPage !== "profile" ? "hidden" : "h-full"}>
          <ProfilePage />
        </div>
      </main>

      {/* Fixed Footer - only show on pages that need it */}
      {!displayJobInsight && currentPage !== "job-search" && <Footer />}
    </div>
  );
}
