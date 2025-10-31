"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, CheckCircle2, Circle, ListChecks } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { JobPreferenceProfile } from "@/lib/types/jobPreferences";
import { useJobPreferenceInterview } from "@/hooks/use-job-preference-interview";

export interface JobPreferenceInterviewControls {
  restart: () => Promise<void>;
}

interface JobPreferenceInterviewProps {
  onPreferencesApplied?: (preferences: JobPreferenceProfile) => void;
  onRegisterControls?: (controls: JobPreferenceInterviewControls | null) => void;
}

export default function JobPreferenceInterview({ onPreferencesApplied, onRegisterControls }: JobPreferenceInterviewProps) {
  const { toast } = useToast();
  const {
    interviewState,
    interview,
    questions,
    responseMap,
    activeQuestion,
    activeQuestionId,
    setActiveQuestionId,
    currentAnswer,
    setCurrentAnswer,
    answeredCount,
    totalQuestions,
    progressValue,
    allAnswered,
    interviewCompleted,
    isStarting,
    isSavingAnswer,
    isFinalizing,
    isApplying,
    isReopening,
    startInterview,
    submitAnswer,
    finalizeInterview,
    applyPreferences,
    reopenInterview,
  } = useJobPreferenceInterview();
  const [autoTriggered, setAutoTriggered] = useState(false);

  const handleStartInterview = useCallback(
    async (
      mode: "manual" | "auto" = "manual",
      options?: { forceRestart?: boolean; toastMessage?: string; suppressToast?: boolean },
    ) => {
      const forceRestart = options?.forceRestart ?? false;
      const suppressToast = options?.suppressToast ?? false;

      if (isStarting) {
        return;
      }

      if (!interviewState?.linkedinProfileAvailable) {
        if (mode === "manual" && !suppressToast) {
          toast({
            variant: "destructive",
            title: "LinkedIn profile required",
            description: "Import your LinkedIn profile first so the AI can personalize the interview.",
          });
        }
        return;
      }

      if (
        !forceRestart &&
        interviewState?.interview &&
        interviewState.interview.status !== "completed"
      ) {
        if (mode === "manual" && !suppressToast) {
          toast({
            title: "Interview already in progress",
            description: "Continue answering the existing questions or finalize them to generate preferences.",
          });
        }
        return;
      }

      try {
        const result = await startInterview({ forceRestart });

        if (result?.skipped) {
          if (result.reason === "preferences_not_empty" && mode === "manual" && !suppressToast) {
            toast({
              title: "Profile already filled",
              description: "Your job preferences are already populated. Clear them if you would like to run the AI interview again.",
            });
          } else if (result.reason === "interview_in_progress" && mode === "manual" && !suppressToast) {
            toast({
              title: "Interview already running",
              description: "Continue with the existing questions below.",
            });
          }
        } else if (mode === "manual" && !suppressToast) {
          toast({
            title: options?.toastMessage ?? (forceRestart ? "Interview restarted" : "Interview started"),
            description: forceRestart
              ? "We generated a fresh set of questions for you."
              : "Answer the personalized questions to auto-fill your job preferences.",
          });
        }
      } catch (error) {
        console.error("Failed to start interview", error);
        if (mode === "manual" && !suppressToast) {
          toast({
            variant: "destructive",
            title: "Could not start interview",
            description: error instanceof Error ? error.message : "Please try again.",
          });
        }
      }
    },
    [interviewState, isStarting, startInterview, toast],
  );

  useEffect(() => {
    if (autoTriggered || !interviewState) {
      return;
    }

    if (
      interviewState.linkedinProfileAvailable &&
      !interviewState.jobPreferencesFilled &&
      !interviewState.interview
    ) {
      setAutoTriggered(true);
      void handleStartInterview("auto", { suppressToast: true });
    }
  }, [autoTriggered, interviewState, handleStartInterview]);

  const handleSubmitAnswer = useCallback(async () => {
    if (!interview || !activeQuestion) {
      return;
    }

    try {
      const result = await submitAnswer();
      toast({
        title: "Answer saved",
        description: result.allAnswered
          ? "All questions answered. Generate your job preferences when you are ready."
          : "Great! When you are ready, continue with the next question.",
      });
    } catch (error) {
      console.error("Failed to record answer", error);
      const message = error instanceof Error ? error.message : "Please try again.";
      toast({
        variant: "destructive",
        title: message === "Answer required" ? "Answer required" : "Could not save answer",
        description: message === "Answer required"
          ? "Share at least a short response so the AI can learn your preferences."
          : message,
      });
    }
  }, [activeQuestion, interview, submitAnswer, toast]);

  const handleFinalizeInterview = useCallback(async () => {
    if (!interview) {
      return;
    }

    try {
      await finalizeInterview();
      toast({
        title: "Preferences drafted",
        description: "Review the AI draft below and apply it to your profile.",
      });
    } catch (error) {
      console.error("Failed to finalize interview", error);
      toast({
        variant: "destructive",
        title: "Could not generate preferences",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  }, [finalizeInterview, interview, toast]);

  const handleApplyPreferences = useCallback(async () => {
    if (!interview) {
      return;
    }

    try {
      const result = await applyPreferences();
      if (result?.preferences) {
        onPreferencesApplied?.(result.preferences as JobPreferenceProfile);
      }
      toast({
        title: "Preferences saved",
        description: "Your job preferences have been applied to your profile. Feel free to fine-tune them below.",
      });
    } catch (error) {
      console.error("Failed to apply preferences", error);
      toast({
        variant: "destructive",
        title: "Could not apply preferences",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  }, [applyPreferences, interview, onPreferencesApplied, toast]);

  const handleReopenInterview = useCallback(async () => {
    if (!interview) {
      return;
    }

    try {
      await reopenInterview();
      await handleStartInterview("manual", { forceRestart: true, suppressToast: true });
      toast({
        title: "Interview restarted",
        description: "We generated a fresh set of questions. Answer them to create new preferences.",
      });
    } catch (error) {
      console.error("Failed to reopen interview", error);
      toast({
        variant: "destructive",
        title: "Could not reopen interview",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  }, [handleStartInterview, interview, reopenInterview, toast]);

  useEffect(() => {
    if (!onRegisterControls) {
      return;
    }

    onRegisterControls({
      restart: () => handleStartInterview("manual", { forceRestart: true }),
    });

    return () => {
      onRegisterControls(null);
    };
  }, [handleStartInterview, onRegisterControls]);

  const renderInterviewContent = () => {
    if (!interviewState) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading interview assistant…
        </div>
      );
    }

    if (!interviewState.linkedinProfileAvailable) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Import your LinkedIn profile to let the AI ask smarter questions and auto-fill your preferences.
          </p>
          <Button variant="outline" size="sm" disabled>
            LinkedIn data required
          </Button>
        </div>
      );
    }

    if (!interview) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            We will ask five short, open-ended questions based on your LinkedIn profile. Answer them however you like and the AI will draft your job preferences.
          </p>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => void handleStartInterview("manual")}
              disabled={isStarting}
              className="bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground shadow-none"
            >
              {isStarting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start AI Interview
            </Button>
            {interviewState.jobPreferencesFilled && (
              <Badge variant="secondary">Profile already filled</Badge>
            )}
          </div>
        </div>
      );
    }

    if (interview.status === "awaiting_confirmation") {
      return (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <ListChecks className="h-5 w-5 text-emerald-500" />
            <div>
              <h4 className="font-semibold text-sm">Your draft job preferences</h4>
              {interview.summary && (
                <p className="text-sm text-muted-foreground mt-1">{interview.summary}</p>
              )}
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
            {renderPreferenceRow("Ideal Role", interview.generatedPreferences?.idealJobTitle)}
            {renderPreferenceRow("Focus Skills", formatList(interview.generatedPreferences?.skills))}
            {renderPreferenceRow("Experience Level", interview.generatedPreferences?.experience)}
            {renderPreferenceRow("Preferred Locations", interview.generatedPreferences?.preferredLocation)}
            {renderPreferenceRow("Work Arrangement", interview.generatedPreferences?.workArrangement)}
            {renderPreferenceRow("Salary Range", interview.generatedPreferences?.salaryRange)}
            {renderPreferenceRow("Industries", formatList(interview.generatedPreferences?.industryPreferences))}
            {renderPreferenceRow("Ideal Company Size", interview.generatedPreferences?.companySize)}
            {renderPreferenceRow("Career Goals", interview.generatedPreferences?.careerGoals)}
            {renderPreferenceRow("Deal Breakers", formatList(interview.generatedPreferences?.dealBreakers))}
            {renderPreferenceRow("Additional Notes", interview.generatedPreferences?.additionalNotes)}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void handleApplyPreferences()}
              disabled={isApplying}
              className="bg-emerald-600 text-white hover:bg-emerald-500 shadow-none"
            >
              {isApplying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply to my profile
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleReopenInterview()}
              disabled={isReopening}
            >
              {isReopening && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tweak my answers
            </Button>
          </div>
        </div>
      );
    }

    if (interview.status === "completed") {
      return null;
    }

    return (
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Question {activeQuestion?.id ?? 1} of {questions.length}</p>
            {activeQuestion?.focus && (
              <p className="text-xs text-muted-foreground mt-1">Focus: {activeQuestion.focus}</p>
            )}
            {activeQuestion ? (
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{activeQuestion.question}</p>
            ) : (
              <p className="text-sm text-muted-foreground mt-2">
                All questions answered. Generate your job preferences when you are ready.
              </p>
            )}
          </div>
        </div>

        {activeQuestion && (
          <div className="space-y-3">
            <Textarea
              value={currentAnswer}
              onChange={(event) => setCurrentAnswer(event.target.value)}
              rows={4}
              placeholder="Share whatever comes to mind. Short reflections are totally fine!"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void handleSubmitAnswer()}
                disabled={isSavingAnswer}
              >
                {isSavingAnswer && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save answer
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  const next = questions.find((question) => question.id !== activeQuestion.id && !responseMap.get(question.id));
                  setActiveQuestionId(next?.id ?? activeQuestion.id);
                }}
              >
                Skip for now
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {questions.map((question) => {
            const answered = responseMap.has(question.id) && responseMap.get(question.id)!.answer.trim().length > 0;
            const isActive = question.id === activeQuestionId;
            return (
              <Button
                key={question.id}
                type="button"
                variant={isActive ? "secondary" : answered ? "outline" : "ghost"}
                size="sm"
                onClick={() => setActiveQuestionId(question.id)}
                className="flex items-center gap-1"
              >
                {answered ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                Q{question.id}
              </Button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void handleFinalizeInterview()}
            disabled={!allAnswered || isFinalizing}
            className="bg-emerald-600 text-white hover:bg-emerald-500 shadow-none"
          >
            {isFinalizing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate job preferences
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleStartInterview("manual", { forceRestart: true })}
            disabled={isStarting}
          >
            Restart interview
          </Button>
        </div>

      </div>
    );
  };

  if (interviewCompleted) {
    return null;
  }

  return (
    <Card className="p-5 shadow-none border border-dashed border-primary/40 bg-primary/5">
      <div className="flex flex-col items-end gap-2">
        <Progress value={progressValue} className="w-full h-2" />
        <span className="text-xs text-muted-foreground">{answeredCount}/{totalQuestions} answered</span>
      </div>
      <div className="mt-4">
        {renderInterviewContent()}
      </div>
    </Card>
  );
}

function renderPreferenceRow(label: string, value?: string) {
  if (!value) {
    return null;
  }
  return (
    <div className="grid gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function formatList(list?: string[]) {
  if (!list || list.length === 0) {
    return undefined;
  }
  return list.join(", ");
}
