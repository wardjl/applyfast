"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { Loader2, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useJobPreferenceInterview } from "@/hooks/use-job-preference-interview";
import OnboardingLinkedInForm from "./components/OnboardingLinkedInForm";

const stepOrder = ["linkedin", "questions", "summary"] as const;
type Step = (typeof stepOrder)[number];

const stepLabels: Record<Step, string> = {
  linkedin: "LinkedIn",
  questions: "Questions",
  summary: "Review",
};

export default function OnboardingPage() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const isRedoMode = searchParams.has("redo");
  const [autoStarted, setAutoStarted] = useState(false);
  const [autoFinalized, setAutoFinalized] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>("linkedin");
  const [initialized, setInitialized] = useState(false);
  const [userOverrodeStep, setUserOverrodeStep] = useState(false);
  const [redoHandled, setRedoHandled] = useState(false);

  const {
    interviewState,
    interview,
    activeQuestion,
    currentAnswer,
    setCurrentAnswer,
    submitAnswer,
    isSavingAnswer,
    answeredCount,
    totalQuestions,
    allAnswered,
    finalizeInterview,
    isApplying,
    applyPreferences,
    startInterview,
    interviewCompleted,
  } = useJobPreferenceInterview({ enabled: isAuthenticated });

  const maxStep = useMemo<Step>(() => {
    if (interview?.status === "awaiting_confirmation") {
      return "summary";
    }
    if (interviewState?.linkedinProfileAvailable) {
      return "questions";
    }
    return "linkedin";
  }, [interview?.status, interviewState?.linkedinProfileAvailable]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!interviewState) {
      return;
    }

    if (!isRedoMode && (interviewState.jobPreferencesFilled || interviewCompleted)) {
      router.replace("/dashboard");
    }
  }, [interviewCompleted, interviewState, isRedoMode, router]);

  const maxStepIndex = useMemo(() => stepOrder.indexOf(maxStep), [maxStep]);
  const currentStepIndex = useMemo(() => stepOrder.indexOf(currentStep), [currentStep]);

  useEffect(() => {
    if (!interviewState) {
      return;
    }

    if (!initialized) {
      setCurrentStep(maxStep);
      setInitialized(true);
      setUserOverrodeStep(false);
      return;
    }

    if (currentStepIndex > maxStepIndex) {
      setCurrentStep(maxStep);
      setUserOverrodeStep(false);
      return;
    }

    if (!userOverrodeStep && currentStepIndex < maxStepIndex) {
      setCurrentStep(maxStep);
    }
  }, [currentStepIndex, initialized, interviewState, maxStep, maxStepIndex, userOverrodeStep]);

  useEffect(() => {
    if (!isRedoMode || redoHandled || !interviewState || !isAuthenticated) {
      return;
    }

    if (!interviewState.linkedinProfileAvailable) {
      return;
    }

    if (interview && interview.status === "in_progress") {
      return;
    }

    setAutoStarted(true);
    setAutoFinalized(false);
    setRedoHandled(true);
    void startInterview({ forceRestart: true }).catch((error) => {
      console.error("Failed to restart onboarding interview", error);
      setRedoHandled(false);
      setAutoStarted(false);
      toast({
        variant: "destructive",
        title: "Could not restart questions",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    });
  }, [isAuthenticated, interview, interviewState, isRedoMode, redoHandled, startInterview, toast]);

  useEffect(() => {
    if (autoStarted || !interviewState || !isAuthenticated) {
      return;
    }

    if (interviewState.linkedinProfileAvailable && !interviewState.interview) {
      setAutoStarted(true);
      void startInterview().catch((error) => {
        console.error("Failed to start onboarding interview", error);
        toast({
          variant: "destructive",
          title: "Could not start questions",
          description: error instanceof Error ? error.message : "Please try again.",
        });
      });
    }
  }, [autoStarted, interviewState, isAuthenticated, startInterview, toast]);

  useEffect(() => {
    if (!interview || interview.status !== "in_progress" || !allAnswered || autoFinalized) {
      return;
    }

    setAutoFinalized(true);
    void finalizeInterview().catch((error) => {
      console.error("Failed to finalize interview", error);
      setAutoFinalized(false);
      toast({
        variant: "destructive",
        title: "Could not prepare profile",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    });
  }, [allAnswered, autoFinalized, finalizeInterview, interview, toast]);

  const accessibleSteps = useMemo(
    () => stepOrder.filter((step) => stepOrder.indexOf(step) <= maxStepIndex),
    [maxStepIndex],
  );

  const handleStepChange = (step: Step) => {
    const targetIndex = stepOrder.indexOf(step);
    if (targetIndex > maxStepIndex) {
      return;
    }
    setCurrentStep(step);
    setUserOverrodeStep(targetIndex < maxStepIndex);
  };

  const questionPosition = useMemo(() => {
    if (!activeQuestion) {
      return null;
    }

    return `${activeQuestion.id} of ${totalQuestions}`;
  }, [activeQuestion, totalQuestions]);

  const handleSubmitAnswer = async () => {
    if (!activeQuestion) {
      return;
    }

    try {
      await submitAnswer();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please try again.";
      toast({
        variant: "destructive",
        title: message === "Answer required" ? "Answer required" : "Could not save answer",
        description:
          message === "Answer required"
            ? "Share at least a short response so we can tailor your profile."
            : message,
      });
    }
  };

  const handleApplyPreferences = async () => {
    try {
      await applyPreferences();
      toast({
        title: "Profile saved",
        description: "Great! You're ready to explore your dashboard.",
      });
      router.replace("/dashboard");
    } catch (error) {
      console.error("Failed to apply preferences", error);
      toast({
        variant: "destructive",
        title: "Could not save profile",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const showLinkedInStep = currentStep === "linkedin";
  const showQuestionStep = currentStep === "questions" && interviewState?.linkedinProfileAvailable;
  const showSummaryStep = currentStep === "summary" && interview?.status === "awaiting_confirmation";
  const isLoadingState = authLoading || !interviewState;

  if (isLoadingState) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your setup…
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      {isRedoMode && (
        <button
          onClick={() => router.push("/dashboard")}
          className="fixed right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label="Close onboarding"
        >
          <X className="h-5 w-5" />
        </button>
      )}
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <header className="text-center">
          <h1 className="text-2xl font-semibold">Let&apos;s personalize your job search</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We start by understanding your background and preferences so we can surface the right roles.
          </p>
        </header>

        {accessibleSteps.length > 1 && (
          <nav className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            {accessibleSteps.map((step, index) => {
              const isActive = step === currentStep;
              return (
                <div key={step} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleStepChange(step)}
                    disabled={isActive}
                    className={`rounded-full px-3 py-1 transition-colors ${
                      isActive ? "bg-primary/10 text-primary font-medium" : "hover:text-foreground"
                    }`}
                  >
                    {stepLabels[step]}
                  </button>
                  {index < accessibleSteps.length - 1 && <span aria-hidden className="text-border">•</span>}
                </div>
              );
            })}
          </nav>
        )}

        {showLinkedInStep && (
          <OnboardingLinkedInForm
            onImported={() => {
              setAutoStarted(false);
              const questionsIndex = stepOrder.indexOf("questions");
              if (maxStepIndex >= questionsIndex) {
                setCurrentStep("questions");
              }
              setUserOverrodeStep(false);
            }}
          />
        )}

        {showQuestionStep && (
          <>
            {activeQuestion ? (
              <Card className="p-8 shadow-none">
                <div className="flex flex-col items-center gap-6 text-center">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {questionPosition}
                  </div>
                  <h2 className="max-w-xl text-xl font-semibold leading-tight">{activeQuestion.question}</h2>
                  <Textarea
                    value={currentAnswer}
                    onChange={(event) => setCurrentAnswer(event.target.value)}
                    rows={5}
                    placeholder="Share your honest thoughts. A few sentences are perfect."
                    className="min-h-[140px]"
                  />
                  <Button
                    onClick={() => void handleSubmitAnswer()}
                    className="w-full sm:w-auto"
                    disabled={isSavingAnswer || currentAnswer.trim().length === 0}
                  >
                    {isSavingAnswer && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save & Continue
                  </Button>
                  {answeredCount < totalQuestions && (
                    <p className="text-xs text-muted-foreground">
                      {answeredCount} of {totalQuestions} questions answered
                    </p>
                  )}
                </div>
              </Card>
            ) : (
              <Card className="p-6 shadow-none">
                {interview?.status === "awaiting_confirmation" ? (
                  <div className="text-center text-sm text-muted-foreground">
                    All questions answered. Review your draft to continue.
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Preparing your questions…
                  </div>
                )}
              </Card>
            )}
          </>
        )}

        {showSummaryStep && (
          <Card className="p-8 shadow-none">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-semibold">Draft preferences ready</h2>
              {interview?.summary && (
                <p className="text-sm text-muted-foreground max-w-xl">{interview.summary}</p>
              )}
              <Button
                onClick={() => void handleApplyPreferences()}
                disabled={isApplying}
                className="w-full sm:w-auto"
              >
                {isApplying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save my profile & continue
              </Button>
            </div>
          </Card>
        )}

        {interview?.status === "in_progress" && allAnswered && !showSummaryStep && (
          <Card className="p-6 shadow-none">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Drafting your job preferences…
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
