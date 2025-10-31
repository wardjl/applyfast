import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { DEFAULT_SCORING_CRITERIA } from "../lib/constants";
import {
  buildJobTextFromLinkedInDetails,
  buildSystemPrompt,
  jobScoringSchema,
  repairStructuredJson,
} from "./jobScoringUtils";
import { streamObject } from "ai";
import { z } from "zod";
import { getOptionalUserId } from "./lib/auth";

const SCORING_MODEL = process.env.AI_GATEWAY_SCORING_MODEL || "google/gemini-2.5-flash-lite";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const linkedInSectionSchema = z.object({
  heading: z.string(),
  items: z.array(z.string()).optional(),
  content: z.string().optional().nullable(),
});

const linkedInJobDetailsSchema = z.object({
  jobId: z.string().optional().nullable(),
  jobUrl: z.string(),
  canonicalUrl: z.string().optional().nullable(),
  capturedAt: z.number(),
  layoutVariant: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  companyUrl: z.string().optional().nullable(),
  companyLogo: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  postedAt: z.string().optional().nullable(),
  applicantsCount: z.string().optional().nullable(),
  employmentType: z.string().optional().nullable(),
  workplaceType: z.string().optional().nullable(),
  badges: z.array(z.string()).default([]),
  descriptionHtml: z.string().optional().nullable(),
  descriptionText: z.string().optional().nullable(),
  responsibilities: z.array(z.string()).default([]),
  qualifications: z.array(z.string()).default([]),
  contractDetails: z.array(z.string()).default([]),
  additionalSections: z.array(linkedInSectionSchema).default([]),
  companyIndustry: z.string().optional().nullable(),
  companySize: z.string().optional().nullable(),
  companyLinkedInCount: z.string().optional().nullable(),
  companyDescriptionHtml: z.string().optional().nullable(),
  companyDescriptionText: z.string().optional().nullable(),
  jobPoster: z
    .object({
      name: z.string().optional().nullable(),
      title: z.string().optional().nullable(),
      profileUrl: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  applyUrl: z.string().optional().nullable(),
  warnings: z.array(z.string()).default([]),
  rawHtml: z.string().optional().nullable(),
});

const requestSchema = z.object({
  job: linkedInJobDetailsSchema,
});

export const streamJobScore = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  const userId = await getOptionalUserId(ctx);
  if (!userId) {
    return new Response("Unauthorized", {
      status: 401,
      headers: corsHeaders,
    });
  }

  let parsedBody: z.infer<typeof requestSchema>;
  try {
    const json = await request.json();
    const result = requestSchema.safeParse(json);
    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid request body",
          details: result.error.flatten(),
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }
    parsedBody = result.data;
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to parse request body",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  const jobDetails = parsedBody.job;

  try {
    const [userProfile, interviewSummary, scoringPromptSettings] = await Promise.all([
      ctx.runQuery(internal.jobScraping.getUserProfileByUserId, { userId }),
      ctx.runQuery(internal.jobPreferenceInterviews.getLatestCompletedInterviewSummary, { userId }),
      ctx.runQuery(internal.aiScoringPrompts.getAiScoringPromptInternal, { userId }),
    ]);

    const scoringCriteria =
      scoringPromptSettings?.useCustomPrompt && scoringPromptSettings?.customPrompt
        ? scoringPromptSettings.customPrompt
        : DEFAULT_SCORING_CRITERIA;

    await ctx.runMutation(internal.aiUsageTracking.checkAndIncrementAiUsage, {
      userId,
      incrementBy: 1,
    });

    const jobText = buildJobTextFromLinkedInDetails({
      title: jobDetails.title ?? undefined,
      companyName: jobDetails.companyName ?? undefined,
      location: jobDetails.location ?? undefined,
      employmentType: jobDetails.employmentType ?? undefined,
      workplaceType: jobDetails.workplaceType ?? undefined,
      postedAt: jobDetails.postedAt ?? undefined,
      applicantsCount: jobDetails.applicantsCount ?? undefined,
      companySize: jobDetails.companySize ?? undefined,
      companyIndustry: jobDetails.companyIndustry ?? undefined,
      descriptionText: jobDetails.descriptionText ?? undefined,
      responsibilities: jobDetails.responsibilities ?? [],
      qualifications: jobDetails.qualifications ?? [],
      companyDescriptionText: jobDetails.companyDescriptionText ?? undefined,
    });

    const systemPrompt = buildSystemPrompt({
      userProfile,
      interviewSummary,
      scoringCriteria,
    });

    // Build evaluation prompt - include requirement checks if user has role requirements
    let evaluationPrompt = `Evaluate this job and respond with JSON containing:
- "score" (1-10): how well this job suits the candidate`;

    if (userProfile?.roleRequirements && userProfile.roleRequirements.length > 0) {
      evaluationPrompt += `
- "requirementChecks" (array): For each role requirement below, provide an object with:
  - "requirement" (string): the exact requirement text
  - "score" (0 or 1): 1 if the job satisfies this requirement, 0 if not

Role Requirements to check:
${userProfile.roleRequirements.map((req, idx) => `${idx + 1}. ${req}`).join('\n')}`;
    }

    evaluationPrompt += `
- "description" (2-3 sentences): explanation that references the requirement checks, addressing the candidate directly`;

    evaluationPrompt += `\n\n${jobText}`;

    // Use streamObject to get incremental partial updates
    // Hook an AbortController so we can cancel upstream on client disconnect/error
    const abortController = new AbortController();
    const prevWarn = (globalThis as any).AI_SDK_LOG_WARNINGS;
    const streamResult = streamObject({
      model: SCORING_MODEL,
      schema: jobScoringSchema,
      system: systemPrompt,
      prompt: evaluationPrompt,
      mode: "json",
      temperature: 0.3,
      // Note: topK is not supported by OpenAI models, removed to prevent warnings
      experimental_repairText: async ({ text }) => repairStructuredJson(text),
      abortSignal: abortController.signal,
      onFinish: async ({ error }) => {
        if (error) {
          console.error("[JobScoring] Stream error:", error);
        }
        // restore global warning flag
        if (prevWarn === undefined) {
          try { delete (globalThis as any).AI_SDK_LOG_WARNINGS; } catch {}
        } else {
          (globalThis as any).AI_SDK_LOG_WARNINGS = prevWarn;
        }
      },
    });

    // Manually stream partial updates for true incremental streaming
    // This sends each partial object update as a separate chunk, following AI SDK pattern
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      start: async (controller) => {
        try {
          // Stream each partial update as it arrives
          for await (const partial of streamResult.partialObjectStream) {
            // Encode as newline-delimited JSON for client parsing
            controller.enqueue(
              encoder.encode(JSON.stringify(partial) + "\n")
            );
          }

          // Send final complete object
          const finalObject = await streamResult.object;
          controller.enqueue(
            encoder.encode(JSON.stringify(finalObject) + "\n")
          );

          controller.close();
        } catch (error) {
          console.error("[JobScoring] Stream error during iteration:", error);
          try { controller.error(error); } finally {
            abortController.abort(error instanceof Error ? error : new Error("stream error"));
          }
        }
      },
      cancel: (reason) => {
        console.warn("[JobScoring] Client cancelled stream:", reason);
        abortController.abort(reason instanceof Error ? reason : new Error(String(reason ?? "cancelled")));
        // also restore global warning flag if onFinish won't run
        const prev = (globalThis as any).AI_SDK_LOG_WARNINGS;
        if (prev !== undefined) return; // already restored by onFinish later
        try { delete (globalThis as any).AI_SDK_LOG_WARNINGS; } catch {}
      },
    });

    // Optional: forward client aborts
    request.signal?.addEventListener("abort", () => abortController.abort(new Error("client aborted")));

    return new Response(readableStream, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to initiate job scoring stream",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
