/**
 * Shared Job Scoring Schema
 * 
 * This schema defines the structure of AI-generated job evaluations.
 * Used by both server-side (Convex) and client-side (Chrome extension) code.
 * 
 * Single source of truth to prevent drift between server and client implementations.
 */

import { z } from "zod";

export const jobScoringSchema = z.object({
  score: z
    .number()
    .min(1)
    .max(10)
    .describe(
      "A score from 1-10 indicating how well this job suits the user's profile and preferences"
    ),
  requirementChecks: z
    .array(
      z.object({
        requirement: z.string().describe("The specific role requirement from user profile"),
        score: z.number().min(0).max(1).describe("1 if job satisfies this requirement, 0 if not"),
      })
    )
    .optional()
    .describe("Binary validation (1 or 0) for each role requirement from user profile"),
  description: z
    .string()
    .describe(
      "A brief explanation (2-3 sentences) of why this score was given, focusing on job fit for the user's background and preferences"
    ),
});

export type JobScoringResult = z.infer<typeof jobScoringSchema>;
