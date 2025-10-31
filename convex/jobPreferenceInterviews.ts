import { v } from "convex/values";
import { action, mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { generateObject } from "ai";
import { z } from "zod";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { JobPreferenceProfile, isJobPreferencesEmpty } from "../lib/types/jobPreferences";
import { requireUserId } from "./lib/auth";

const QUESTION_COUNT = 5;
const MAX_PROFILE_SUMMARY_LENGTH = 2500;
const MAX_ANSWER_SUMMARY_LENGTH = 3000;
const MAX_SKILLS_DISPLAY = 12;
const MAX_EXPERIENCES_DISPLAY = 3;
const MAX_EDUCATION_DISPLAY = 2;
const ONBOARDING_MODEL = process.env.AI_GATEWAY_ONBOARDING_MODEL || "google/gemini-2.5-pro";

const questionResponseSchema = z.object({
  questions: z.array(z.object({
    question: z.string().min(5),
    focus: z.string().optional(),
  })).length(QUESTION_COUNT),
});

const generatedPreferencesSchema = z.object({
  preferences: z.object({
    idealJobTitle: z.string().optional(),
    skills: z.array(z.string()).optional(),
    experience: z.string().optional(),
    preferredLocation: z.string().optional(),
    workArrangement: z.enum(["remote", "hybrid", "onsite", "flexible"]).optional(),
    salaryRange: z.string().optional(),
    industryPreferences: z.array(z.string()).optional(),
    companySize: z.string().optional(),
    careerGoals: z.string().optional(),
    roleRequirements: z.array(z.string()).optional(),
    dealBreakers: z.array(z.string()).optional(),
    additionalNotes: z.string().optional(),
  }),
  summary: z.string().min(20),
});

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

type InterviewRecord = {
  _id: Id<"jobPreferenceInterviews">;
  _creationTime: number;
  userId: string;
  status: "in_progress" | "awaiting_confirmation" | "completed";
  questions: InterviewQuestion[];
  responses?: InterviewResponse[];
  generatedPreferences?: JobPreferenceProfile;
  summary?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
};

function extractTopList(items: any[] | undefined | null, key: string, limit = 10) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map((item) => {
      const value = typeof item === "string" ? item : item?.[key];
      return typeof value === "string" ? value.trim() : null;
    })
    .filter((value): value is string => !!value)
    .slice(0, limit);
}

function summarizeLinkedInProfile(profile: any) {
  if (!profile) {
    return "";
  }

  const lines: string[] = [];
  if (profile.fullName) {
    lines.push(`Name: ${profile.fullName}`);
  } else if (profile.firstName || profile.lastName) {
    lines.push(`Name: ${(profile.firstName ?? "") + " " + (profile.lastName ?? "")}`.trim());
  }

  if (profile.headline) {
    lines.push(`Headline: ${profile.headline}`);
  }

  if (profile.about) {
    lines.push(`About: ${profile.about}`);
  }

  const experiences = Array.isArray(profile.experiences) ? profile.experiences.slice(0, MAX_EXPERIENCES_DISPLAY) : [];
  if (experiences.length > 0) {
    lines.push("Key Experiences:");
    experiences.forEach((exp: any, idx: number) => {
      const title = exp?.title || exp?.jobTitle || exp?.position || "";
      const org = exp?.subtitle || exp?.companyName || exp?.company || "";
      const duration = exp?.metadata || exp?.caption || exp?.timePeriod || "";
      const description = exp?.description || exp?.summary || "";
      const experienceLine = [
        title,
        org ? `at ${org}` : "",
        duration ? `(${duration})` : "",
      ]
        .filter(Boolean)
        .join(" ");
      lines.push(` ${idx + 1}. ${experienceLine || "Experience details unavailable"}`);
      if (description) {
        lines.push(`    Summary: ${description}`);
      }
    });
  }

  const education = Array.isArray(profile.educations) ? profile.educations.slice(0, MAX_EDUCATION_DISPLAY) : [];
  if (education.length > 0) {
    lines.push("Education Highlights:");
    education.forEach((edu: any, idx: number) => {
      const title = edu?.title || edu?.degree || edu?.school || "";
      const subtitle = edu?.subtitle || edu?.field || "";
      const caption = edu?.caption || edu?.description || "";
      const educationLine = [
        title,
        subtitle ? `- ${subtitle}` : "",
        caption ? `(${caption})` : "",
      ]
        .filter(Boolean)
        .join(" ");
      lines.push(` ${idx + 1}. ${educationLine || "Education details unavailable"}`);
    });
  }

  const topSkills = extractTopList(profile.skills, "title");
  if (topSkills.length === 0 && typeof profile.topSkillsByEndorsements === "string") {
    topSkills.push(...profile.topSkillsByEndorsements.split(",").map((skill: string) => skill.trim()).filter(Boolean));
  }
  if (topSkills.length > 0) {
    lines.push(`Skills: ${topSkills.slice(0, MAX_SKILLS_DISPLAY).join(", ")}`);
  }

  if (profile.addressWithCountry || profile.addressCountryOnly) {
    lines.push(`Location: ${profile.addressWithCountry || profile.addressCountryOnly}`);
  }

  const fullSummary = lines.join("\n");

  // Truncate at last complete sentence to avoid breaking context
  if (fullSummary.length <= MAX_PROFILE_SUMMARY_LENGTH) {
    return fullSummary;
  }

  const truncated = fullSummary.slice(0, MAX_PROFILE_SUMMARY_LENGTH);
  const lastPeriod = truncated.lastIndexOf(".");
  const lastNewline = truncated.lastIndexOf("\n");
  const cutPoint = Math.max(lastPeriod, lastNewline);

  return cutPoint > MAX_PROFILE_SUMMARY_LENGTH * 0.8
    ? truncated.slice(0, cutPoint + 1)
    : truncated;
}

function buildAnswerSummary(responses: InterviewResponse[]) {
  const fullSummary = responses
    .sort((a, b) => a.id - b.id)
    .map((response) => `Q${response.id}: ${response.question}\nA: ${response.answer}`)
    .join("\n\n");

  // Truncate at last complete answer to avoid breaking context
  if (fullSummary.length <= MAX_ANSWER_SUMMARY_LENGTH) {
    return fullSummary;
  }

  const truncated = fullSummary.slice(0, MAX_ANSWER_SUMMARY_LENGTH);
  const lastAnswerBreak = truncated.lastIndexOf("\n\n");

  return lastAnswerBreak > MAX_ANSWER_SUMMARY_LENGTH * 0.7
    ? truncated.slice(0, lastAnswerBreak)
    : truncated;
}

function sanitizePreferences(raw: JobPreferenceProfile): JobPreferenceProfile {
  const normalizeArray = (input?: string[]) => {
    if (!Array.isArray(input)) {
      return undefined;
    }
    const values = input
      .map((item) => item?.toString().trim())
      .filter((item): item is string => !!item);
    return values.length > 0 ? values : undefined;
  };

  const normalizeString = (input?: string) => {
    const value = input?.toString().trim();
    return value ? value : undefined;
  };

  const normalizedWorkArrangement = raw.workArrangement && ["remote", "hybrid", "onsite", "flexible"].includes(raw.workArrangement)
    ? raw.workArrangement
    : undefined;

  return {
    idealJobTitle: normalizeString(raw.idealJobTitle),
    skills: normalizeArray(raw.skills),
    experience: normalizeString(raw.experience),
    preferredLocation: normalizeString(raw.preferredLocation),
    workArrangement: normalizedWorkArrangement,
    salaryRange: normalizeString(raw.salaryRange),
    industryPreferences: normalizeArray(raw.industryPreferences),
    companySize: normalizeString(raw.companySize),
    careerGoals: normalizeString(raw.careerGoals),
    roleRequirements: normalizeArray(raw.roleRequirements),
    dealBreakers: normalizeArray(raw.dealBreakers),
    additionalNotes: normalizeString(raw.additionalNotes),
  };
}

// Query to get the current interview state for the authenticated user
export const getInterviewState = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    const linkedinProfile = await ctx.db
      .query("linkedinProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const interview = await ctx.db
      .query("jobPreferenceInterviews")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first() as InterviewRecord | null;

    let latestCompletedInterview: InterviewRecord | null = null;
    if (interview && interview.status !== "in_progress" && interview.summary) {
      latestCompletedInterview = interview;
    } else {
      latestCompletedInterview = await ctx.db
        .query("jobPreferenceInterviews")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", userId).eq("status", "completed"),
        )
        .order("desc")
        .first() as InterviewRecord | null;

      if (!latestCompletedInterview) {
        latestCompletedInterview = await ctx.db
          .query("jobPreferenceInterviews")
          .withIndex("by_user_status", (q) =>
            q.eq("userId", userId).eq("status", "awaiting_confirmation"),
          )
          .order("desc")
          .first() as InterviewRecord | null;
      }
    }

    return {
      linkedinProfileAvailable: !!linkedinProfile,
      jobPreferencesFilled: !isJobPreferencesEmpty(userProfile),
      interview: interview ?? null,
      latestCompletedInterview: latestCompletedInterview ?? null,
    };
  },
});

// Action to start or resume the AI interview using LinkedIn data
export const startJobPreferenceInterview = action({
  args: {
    forceRestart: v.optional(v.boolean()),
    refreshLinkedInProfile: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    let linkedinProfile = await ctx.runQuery(internal.linkedinProfiles.getLinkedInProfileInternal, {
      userId,
    });

    if (!linkedinProfile) {
      throw new Error("LinkedIn profile not found. Please import your LinkedIn data first.");
    }

    // Refresh LinkedIn profile if requested (for redo mode)
    if (args.refreshLinkedInProfile && linkedinProfile.linkedinUrl) {
      try {
        console.log("Refreshing LinkedIn profile data...", linkedinProfile.linkedinUrl);
        await ctx.runAction(internal.linkedinProfiles.importLinkedInProfileInternal, {
          userId,
          linkedinUrl: linkedinProfile.linkedinUrl,
        });

        // Re-fetch the updated profile
        linkedinProfile = await ctx.runQuery(internal.linkedinProfiles.getLinkedInProfileInternal, {
          userId,
        });

        if (!linkedinProfile) {
          throw new Error("Failed to fetch updated LinkedIn profile");
        }

        console.log("LinkedIn profile refreshed successfully");
      } catch (error) {
        console.error("Failed to refresh LinkedIn profile, using existing data:", error);
        // Continue with existing profile data rather than failing completely
      }
    }

    const userProfile = await ctx.runQuery(internal.userProfiles.getUserProfileInternal, {
      userId,
    });

    if (!args.forceRestart && userProfile && !isJobPreferencesEmpty(userProfile)) {
      return {
        skipped: true,
        reason: "preferences_not_empty",
      };
    }

    const existingInterview = await ctx.runQuery(internal.jobPreferenceInterviews.getLatestInterviewInternal, {
      userId,
    }) as InterviewRecord | null;

    if (!args.forceRestart && existingInterview && existingInterview.status !== "completed") {
      return {
        skipped: true,
        reason: "interview_in_progress",
        interview: existingInterview,
      };
    }

    if (existingInterview && args.forceRestart && existingInterview.status === "in_progress") {
      await ctx.runMutation(internal.jobPreferenceInterviews.deleteInterviewByIdInternal, {
        interviewId: existingInterview._id,
      });
    }

    const profileSummary = summarizeLinkedInProfile(linkedinProfile);

    const systemPrompt = `
You are a concise, empathetic career coach helping a professional clarify their ideal future job.

Write exactly ${QUESTION_COUNT} short, single-sentence interview questions based on the provided LinkedIn profile summary.

Your goal is to uncover how this person envisions their next career step — what kind of work, environment, and growth they truly want.

Each question must:
- Stay under 18 words and focus on one clear topic.
- Be directly informed by the person’s LinkedIn background, roles, industries, or skills.
- Ask about future preferences, motivations, or trade-offs that shape their ideal job.
- Avoid generic or yes/no questions.
- Encourage reflection and reveal priorities (e.g., impact vs. stability, autonomy vs. structure, innovation vs. mastery).
- Sound natural and professional — as if in a thoughtful coaching conversation.
- Use personalization only when it deepens insight or relevance.

Write questions that would help another AI system later score job alignment by understanding what kind of role, culture, and challenges this person would thrive in.

Tone: warm, focused, and genuinely curious.
`.trim();

    let object;
    try {
      const result = await generateObject({
        model: ONBOARDING_MODEL,
        schema: questionResponseSchema,
        system: systemPrompt,
        prompt: `LinkedIn profile summary:\n${profileSummary}\n\nReturn ${QUESTION_COUNT} direct questions ready to show the user.`,
      });
      object = result.object;
    } catch (error) {
      console.error("AI question generation failed:", error);
      throw new Error(
        error instanceof Error && error.message.includes("rate limit")
          ? "AI service is temporarily busy. Please try again in a moment."
          : "Failed to generate interview questions. Please try again."
      );
    }

    const questions = object.questions.map((entry, idx) => ({
      id: idx + 1,
      question: entry.question.trim(),
      focus: entry.focus?.trim() || undefined,
    }));

    const interview = await ctx.runMutation(internal.jobPreferenceInterviews.createInterviewInternal, {
      userId,
      questions,
    }) as InterviewRecord;

    return {
      skipped: false,
      interview,
    };
  },
});

// Mutation to record a user's answer to an interview question
export const recordInterviewAnswer = mutation({
  args: {
    interviewId: v.id("jobPreferenceInterviews"),
    questionId: v.number(),
    answer: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const interview = await ctx.runQuery(internal.jobPreferenceInterviews.getInterviewByIdInternal, {
      interviewId: args.interviewId,
    }) as InterviewRecord | null;
    if (!interview || interview.userId !== userId) {
      throw new Error("Interview not found");
    }

    if (interview.status !== "in_progress") {
      throw new Error("Interview is not accepting responses");
    }

    const questions = interview.questions as InterviewQuestion[];
    const question = questions.find((q) => q.id === args.questionId);
    if (!question) {
      throw new Error("Question not found in interview");
    }

    const trimmedAnswer = args.answer.trim();
    if (!trimmedAnswer) {
      throw new Error("Answer cannot be empty");
    }

    const responses: InterviewResponse[] = Array.isArray(interview.responses)
      ? [...(interview.responses as InterviewResponse[])]
      : [];
    const existingIndex = responses.findIndex((response) => response.id === question.id);
    const responseEntry: InterviewResponse = {
      id: question.id,
      question: question.question,
      answer: trimmedAnswer,
      updatedAt: Date.now(),
    };

    if (existingIndex >= 0) {
      responses[existingIndex] = responseEntry;
    } else {
      responses.push(responseEntry);
    }

    const sortedResponses = responses.sort((a, b) => a.id - b.id);
    await ctx.db.patch(args.interviewId, {
      responses: sortedResponses,
      updatedAt: Date.now(),
    });

    const allAnswered = questions.every((q) =>
      sortedResponses.some((response) => response.id === q.id && response.answer.trim().length > 0),
    );

    return {
      allAnswered,
      responses: sortedResponses,
    };
  },
});

// Action to generate structured job preferences after all responses are collected
export const finalizeJobPreferenceInterview = action({
  args: {
    interviewId: v.id("jobPreferenceInterviews"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const interview = await ctx.runQuery(internal.jobPreferenceInterviews.getInterviewByIdInternal, {
      interviewId: args.interviewId,
    }) as InterviewRecord | null;
    if (!interview || interview.userId !== userId) {
      throw new Error("Interview not found");
    }

    if (interview.status === "awaiting_confirmation") {
      return {
        status: interview.status,
        generatedPreferences: interview.generatedPreferences,
        summary: interview.summary,
      };
    }

    if (interview.status !== "in_progress") {
      throw new Error("Interview cannot be finalized in its current state");
    }

    const responses: InterviewResponse[] = Array.isArray(interview.responses)
      ? (interview.responses as InterviewResponse[])
      : [];
    if (responses.length < QUESTION_COUNT) {
      throw new Error("Please answer all interview questions before finalizing");
    }

    const questions = interview.questions as InterviewQuestion[];
    const missingAnswer = questions.find((question) =>
      !responses.some((response) => response.id === question.id && response.answer.trim().length > 0),
    );
    if (missingAnswer) {
      throw new Error(`Question ${missingAnswer.id} has no answer. Please respond before continuing.`);
    }

    const linkedinProfile = await ctx.runQuery(internal.linkedinProfiles.getLinkedInProfileInternal, {
      userId,
    });
    if (!linkedinProfile) {
      throw new Error("LinkedIn profile not found");
    }

    const profileSummary = summarizeLinkedInProfile(linkedinProfile);
    const answerSummary = buildAnswerSummary(responses);

    const systemPrompt = `
You are an AI career coach synthesizing a user's job preferences.
Respect the user's voice while producing structured, actionable preferences the product can store.
When unsure about an item, omit it rather than inventing details.
Use only the LinkedIn data and interview answers provided.

IMPORTANT: Extract 5-10 specific, measurable role requirements from the interview responses.
Role requirements should be concrete must-haves that can be checked against job postings.
Examples of good requirements:
- "Remote-first culture with flexible hours"
- "Comprehensive health insurance including dental and vision"
- "Minimum salary of $120,000"
- "Work-life balance with reasonable on-call expectations"
- "Opportunities for professional development and conference attendance"
- "Modern tech stack (React, TypeScript, Node.js)"
- "Collaborative team environment with pair programming"
- "Clear career advancement path to senior/lead roles"
- "Company size under 500 employees"
- "Product-focused rather than agency work"

Focus on extracting requirements that cover: compensation, benefits, work arrangement, culture, growth opportunities, tech stack, team dynamics, company characteristics, and work type.
`.trim();

    const prompt = `
LinkedIn profile summary:
${profileSummary}

Interview responses:
${answerSummary}

Create a structured job preference profile capturing the user's goals, preferences, and constraints.
`.trim();

    let object;
    try {
      const result = await generateObject({
        model: ONBOARDING_MODEL,
        schema: generatedPreferencesSchema,
        system: systemPrompt,
        prompt,
      });
      object = result.object;
    } catch (error) {
      console.error("AI preference generation failed:", error);
      throw new Error(
        error instanceof Error && error.message.includes("rate limit")
          ? "AI service is temporarily busy. Please try again in a moment."
          : "Failed to generate job preferences. Please try again."
      );
    }

    const sanitizedPreferences = sanitizePreferences(object.preferences);

    await ctx.runMutation(internal.jobPreferenceInterviews.setGeneratedPreferencesInternal, {
      interviewId: args.interviewId,
      status: "awaiting_confirmation",
      generatedPreferences: sanitizedPreferences,
      summary: object.summary.trim(),
    });

    return {
      status: "awaiting_confirmation",
      generatedPreferences: sanitizedPreferences,
      summary: object.summary.trim(),
    };
  },
});

// Mutation to apply generated preferences to the user's profile
export const applyGeneratedPreferences = mutation({
  args: {
    interviewId: v.id("jobPreferenceInterviews"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const interview = await ctx.db.get(args.interviewId);
    if (!interview || interview.userId !== userId) {
      throw new Error("Interview not found");
    }

    if (interview.status !== "awaiting_confirmation" || !interview.generatedPreferences) {
      throw new Error("No generated preferences available to apply");
    }

    const preferences = interview.generatedPreferences as JobPreferenceProfile;

    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const now = Date.now();

    // Build profile data by merging existing data with new preferences
    const profileData = {
      userId,
      createdAt: existingProfile?.createdAt ?? now,
      updatedAt: now,
      // Apply all preference fields that have values
      ...(preferences.idealJobTitle !== undefined && { idealJobTitle: preferences.idealJobTitle }),
      ...(preferences.skills !== undefined && { skills: preferences.skills }),
      ...(preferences.experience !== undefined && { experience: preferences.experience }),
      ...(preferences.preferredLocation !== undefined && { preferredLocation: preferences.preferredLocation }),
      ...(preferences.workArrangement !== undefined && { workArrangement: preferences.workArrangement }),
      ...(preferences.salaryRange !== undefined && { salaryRange: preferences.salaryRange }),
      ...(preferences.industryPreferences !== undefined && { industryPreferences: preferences.industryPreferences }),
      ...(preferences.companySize !== undefined && { companySize: preferences.companySize }),
      ...(preferences.careerGoals !== undefined && { careerGoals: preferences.careerGoals }),
      ...(preferences.roleRequirements !== undefined && { roleRequirements: preferences.roleRequirements }),
      ...(preferences.dealBreakers !== undefined && { dealBreakers: preferences.dealBreakers }),
      ...(preferences.additionalNotes !== undefined && { additionalNotes: preferences.additionalNotes }),
    };

    if (existingProfile) {
      await ctx.db.replace(existingProfile._id, profileData);
    } else {
      await ctx.db.insert("userProfiles", profileData);
    }

    await ctx.db.patch(args.interviewId, {
      status: "completed",
      completedAt: now,
      updatedAt: now,
    });

    return {
      applied: true,
      preferences,
    };
  },
});

// Mutation to reopen a previously finalized interview for further edits
export const reopenJobPreferenceInterview = mutation({
  args: {
    interviewId: v.id("jobPreferenceInterviews"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const interview = await ctx.db.get(args.interviewId) as InterviewRecord | null;
    if (!interview || interview.userId !== userId) {
      throw new Error("Interview not found");
    }

    if (interview.status === "in_progress") {
      await ctx.runMutation(internal.jobPreferenceInterviews.deleteInterviewByIdInternal, {
        interviewId: args.interviewId,
      });
      return { status: "deleted" };
    }

    return { status: interview.status };
  },
});

// Internal query to fetch the latest interview for a user
export const getLatestInterviewInternal = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const interview = await ctx.db
      .query("jobPreferenceInterviews")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();

    return interview;
  },
});

// Internal query to fetch an interview by its ID
export const getInterviewByIdInternal = internalQuery({
  args: {
    interviewId: v.id("jobPreferenceInterviews"),
  },
  handler: async (ctx, args) => {
    const interview = await ctx.db.get(args.interviewId);
    return interview;
  },
});

// Internal mutation to create a new interview record
export const createInterviewInternal = internalMutation({
  args: {
    userId: v.id("users"),
    questions: v.array(v.object({
      id: v.number(),
      question: v.string(),
      focus: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const interviewId = await ctx.db.insert("jobPreferenceInterviews", {
      userId: args.userId,
      status: "in_progress",
      questions: args.questions,
      responses: [],
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(interviewId);
  },
});

// Internal mutation to update interview status and generated preferences
export const setGeneratedPreferencesInternal = internalMutation({
  args: {
    interviewId: v.id("jobPreferenceInterviews"),
    status: v.union(v.literal("awaiting_confirmation"), v.literal("completed")),
    generatedPreferences: v.optional(v.object({
      idealJobTitle: v.optional(v.string()),
      skills: v.optional(v.array(v.string())),
      experience: v.optional(v.string()),
      preferredLocation: v.optional(v.string()),
      workArrangement: v.optional(v.union(
        v.literal("remote"),
        v.literal("hybrid"),
        v.literal("onsite"),
        v.literal("flexible"),
      )),
      salaryRange: v.optional(v.string()),
      industryPreferences: v.optional(v.array(v.string())),
      companySize: v.optional(v.string()),
      careerGoals: v.optional(v.string()),
      roleRequirements: v.optional(v.array(v.string())),
      dealBreakers: v.optional(v.array(v.string())),
      additionalNotes: v.optional(v.string()),
    })),
    summary: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const update: Record<string, any> = {
      status: args.status,
      updatedAt: Date.now(),
    };

    if (args.generatedPreferences !== undefined) {
      update.generatedPreferences = args.generatedPreferences;
    }
    if (args.summary !== undefined) {
      update.summary = args.summary;
    }
    if (args.completedAt !== undefined) {
      update.completedAt = args.completedAt;
    }

    await ctx.db.patch(args.interviewId, update);
  },
});

export const deleteInterviewByIdInternal = internalMutation({
  args: {
    interviewId: v.id("jobPreferenceInterviews"),
  },
  handler: async (ctx, args) => {
    // Check if the interview exists before attempting to delete
    const interview = await ctx.db.get(args.interviewId);
    if (interview) {
      await ctx.db.delete(args.interviewId);
    }
    // Silently succeed if interview doesn't exist (already deleted)
  },
});

// Internal query to get the latest completed interview summary for a user
// This is used to enhance job scoring prompts with the user's career narrative
export const getLatestCompletedInterviewSummary = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const interview = await ctx.db
      .query("jobPreferenceInterviews")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", args.userId).eq("status", "completed")
      )
      .order("desc")
      .first();

    return interview?.summary ?? null;
  },
});
