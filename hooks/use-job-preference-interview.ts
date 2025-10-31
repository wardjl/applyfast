"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { JobPreferenceProfile } from "@/lib/types/jobPreferences";

type InterviewStatus = "in_progress" | "awaiting_confirmation" | "completed";

type InterviewQuestion = {
  id: number;
  question: string;
  focus?: string;
};

type InterviewResponse = {
  id: number;
  question: string;
  answer: string;
  updatedAt: number;
};

export interface InterviewRecord {
  _id: Id<"jobPreferenceInterviews">;
  status: InterviewStatus;
  questions: InterviewQuestion[];
  responses?: InterviewResponse[];
  generatedPreferences?: JobPreferenceProfile;
  summary?: string;
}

interface UseJobPreferenceInterviewOptions {
  enabled?: boolean;
}

export interface SubmitAnswerResult {
  allAnswered: boolean;
  responses: InterviewResponse[];
}

type StartInterviewResult = {
  skipped: boolean;
  interview: InterviewRecord | null;
  reason?: string;
};

export function useJobPreferenceInterview(options?: UseJobPreferenceInterviewOptions) {
  const isEnabled = options?.enabled === false ? false : true;

  const interviewState = useQuery(
    api.jobPreferenceInterviews.getInterviewState,
    isEnabled ? {} : undefined,
  );
  const startInterviewAction = useAction(api.jobPreferenceInterviews.startJobPreferenceInterview);
  const finalizeInterviewAction = useAction(api.jobPreferenceInterviews.finalizeJobPreferenceInterview);
  const recordAnswerMutation = useMutation(api.jobPreferenceInterviews.recordInterviewAnswer);
  const applyPreferencesMutation = useMutation(api.jobPreferenceInterviews.applyGeneratedPreferences);
  const reopenInterviewMutation = useMutation(api.jobPreferenceInterviews.reopenJobPreferenceInterview);

  const interview: InterviewRecord | null = useMemo(() => {
    const raw = interviewState?.interview;
    if (!raw) {
      return null;
    }

    return {
      _id: raw._id,
      status: raw.status as InterviewStatus,
      questions: (raw.questions as InterviewQuestion[]) ?? [],
      responses: (raw.responses as InterviewResponse[]) ?? [],
      generatedPreferences: raw.generatedPreferences as JobPreferenceProfile | undefined,
      summary: raw.summary ?? undefined,
    };
  }, [interviewState?.interview]);

  const questions = useMemo(() => interview?.questions ?? [], [interview]);
  const responses = useMemo(() => interview?.responses ?? [], [interview]);

  const responseMap = useMemo(() => {
    const map = new Map<number, InterviewResponse>();
    responses.forEach((response) => {
      map.set(response.id, response);
    });
    return map;
  }, [responses]);

  const [activeQuestionId, setActiveQuestionId] = useState<number | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState("");

  useEffect(() => {
    if (!interview) {
      setActiveQuestionId(null);
      setCurrentAnswer("");
      return;
    }

    const questionIds = new Set(questions.map((question) => question.id));
    if (activeQuestionId && questionIds.has(activeQuestionId)) {
      return;
    }

    const firstUnanswered = questions.find((question) => {
      const response = responseMap.get(question.id);
      return !response || response.answer.trim().length === 0;
    });

    const fallback = firstUnanswered?.id ?? questions[0]?.id ?? null;
    setActiveQuestionId(fallback);
  }, [interview, questions, responseMap, activeQuestionId]);

  useEffect(() => {
    if (!interview || activeQuestionId === null) {
      setCurrentAnswer("");
      return;
    }

    const existing = responseMap.get(activeQuestionId);
    setCurrentAnswer(existing?.answer ?? "");
  }, [interview, activeQuestionId, responseMap]);

  const answeredCount = useMemo(() => {
    return questions.filter((question) => {
      const response = responseMap.get(question.id);
      return !!(response && response.answer.trim().length > 0);
    }).length;
  }, [questions, responseMap]);

  const totalQuestions = questions.length;

  const progressValue = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const allAnswered = totalQuestions > 0 && answeredCount === totalQuestions;
  const interviewCompleted = interview?.status === "completed";
  const activeQuestion = activeQuestionId !== null
    ? questions.find((question) => question.id === activeQuestionId) ?? null
    : null;

  const [isStarting, setIsStarting] = useState(false);
  const [isSavingAnswer, setIsSavingAnswer] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isReopening, setIsReopening] = useState(false);

  const startInterview = useCallback(
    async (options?: { forceRestart?: boolean; refreshLinkedInProfile?: boolean }): Promise<StartInterviewResult> => {
      if (isStarting) {
        return { skipped: false, interview: interview ?? null, reason: undefined };
      }

      setIsStarting(true);
      try {
        if (options?.forceRestart) {
          setActiveQuestionId(null);
          setCurrentAnswer("");
        }

        const result = await startInterviewAction({
          forceRestart: options?.forceRestart ? true : undefined,
          refreshLinkedInProfile: options?.refreshLinkedInProfile ? true : undefined,
        });

        if (!result) {
          return { skipped: false, interview: null };
        }

        const interviewRecord = (result.interview as InterviewRecord | null) ?? null;
        if (result.skipped) {
          return {
            skipped: true,
            interview: interviewRecord,
            reason: typeof result.reason === "string" ? result.reason : undefined,
          };
        }

        return {
          skipped: false,
          interview: interviewRecord,
        };
      } finally {
        setIsStarting(false);
      }
    },
    [interview, isStarting, startInterviewAction],
  );

  const submitAnswer = useCallback(
    async () => {
      if (!interview || !activeQuestion) {
        throw new Error("Interview not ready");
      }

      const trimmed = currentAnswer.trim();
      if (!trimmed) {
        throw new Error("Answer required");
      }

      setIsSavingAnswer(true);
      try {
        const result = await recordAnswerMutation({
          interviewId: interview._id,
          questionId: activeQuestion.id,
          answer: trimmed,
        });

        const nextQuestion = questions.find((question) =>
          !result.responses.some(
            (response) => response.id === question.id && response.answer.trim().length > 0,
          ),
        );

        if (nextQuestion) {
          setActiveQuestionId(nextQuestion.id);
          const nextResponse = result.responses.find((response) => response.id === nextQuestion.id);
          setCurrentAnswer(nextResponse?.answer ?? "");
        } else {
          setCurrentAnswer("");
        }

        return result as SubmitAnswerResult;
      } finally {
        setIsSavingAnswer(false);
      }
    },
    [interview, activeQuestion, currentAnswer, recordAnswerMutation, questions],
  );

  const finalizeInterview = useCallback(
    async () => {
      if (!interview) {
        throw new Error("Interview not ready");
      }

      setIsFinalizing(true);
      try {
        return await finalizeInterviewAction({
          interviewId: interview._id,
        });
      } finally {
        setIsFinalizing(false);
      }
    },
    [finalizeInterviewAction, interview],
  );

  const applyPreferences = useCallback(
    async () => {
      if (!interview) {
        throw new Error("Interview not ready");
      }

      setIsApplying(true);
      try {
        const result = await applyPreferencesMutation({
          interviewId: interview._id,
        });
        return result;
      } finally {
        setIsApplying(false);
      }
    },
    [applyPreferencesMutation, interview],
  );

  const reopenInterview = useCallback(
    async () => {
      if (!interview) {
        throw new Error("Interview not ready");
      }

      setIsReopening(true);
      try {
        const result = await reopenInterviewMutation({
          interviewId: interview._id,
        });
        setActiveQuestionId(null);
        setCurrentAnswer("");
        return result;
      } finally {
        setIsReopening(false);
      }
    },
    [interview, reopenInterviewMutation],
  );

  return {
    interviewState,
    interview,
    questions,
    responses,
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
  };
}
