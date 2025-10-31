/**
 * Scoring Utilities - Prompt building and job scoring logic
 *
 * This module reuses the exact same scoring prompts and logic as the server-side
 * implementation, ensuring consistent scoring behavior between local and cloud AI.
 */

import { streamObject } from 'ai';
import { createChromeAIModel } from './chrome-ai-provider';
import type { Doc } from '@/convex/_generated/dataModel';
import type { LinkedInJobDetailsPayload } from '../shared/linkedin';
import { jobScoringSchema, type JobScoringResult, type StreamResult } from '../shared/streaming-types';

/**
 * Convert numeric score (1-10) to descriptive fit text
 */
export function getScoreDescription(score: number): string {
  if (score >= 7) return 'Good fit';
  if (score >= 5) return 'Moderate fit';
  return 'Bad fit';
}

// Re-export for backward compatibility
export { jobScoringSchema };
export type { JobScoringResult };

/**
 * Build job text from LinkedIn job details
 */
function buildJobText(job: LinkedInJobDetailsPayload): string {
  return `
Job Title: ${job.title || 'Not specified'}
Company: ${job.companyName || 'Not specified'}
Location: ${job.location || 'Not specified'}
Employment Type: ${job.employmentType || 'Not specified'}
Workplace Type: ${job.workplaceType || 'Not specified'}
Posted: ${job.postedAt || 'Not specified'}
Applicants: ${job.applicantsCount || 'Not specified'}
Company Size: ${job.companySize || 'Not specified'}
Company Industry: ${job.companyIndustry || 'Not specified'}

Job Description:
${job.descriptionText || 'No description available'}

${job.responsibilities && job.responsibilities.length > 0 ? `\nResponsibilities:\n${job.responsibilities.map((r) => `- ${r}`).join('\n')}` : ''}

${job.qualifications && job.qualifications.length > 0 ? `\nQualifications:\n${job.qualifications.map((q) => `- ${q}`).join('\n')}` : ''}

${job.companyDescriptionText ? `\nAbout the Company:\n${job.companyDescriptionText}` : ''}
  `.trim();
}

/**
 * Build system prompt from user profile
 */
function buildSystemPrompt(
  userProfile: Doc<'userProfiles'> | null,
  interviewSummary?: string | null,
  scoringCriteria?: string | null,
  defaultScoringCriteria?: string | null
): string {
  let systemPrompt = `You are evaluating job opportunities for a candidate based on their profile and preferences. Write your evaluation directly to the candidate using second-person perspective (you/your).

CANDIDATE PROFILE:`;

  if (userProfile) {
    if (userProfile.idealJobTitle) {
      systemPrompt += `\n- Ideal Job Title: ${userProfile.idealJobTitle}`;
    }
    if (userProfile.experience) {
      systemPrompt += `\n- Experience Level: ${userProfile.experience}`;
    }
    if (userProfile.skills && userProfile.skills.length > 0) {
      systemPrompt += `\n- Skills: ${userProfile.skills.join(', ')}`;
    }
    if (userProfile.preferredLocation) {
      systemPrompt += `\n- Preferred Location: ${userProfile.preferredLocation}`;
    }
    if (userProfile.workArrangement && userProfile.workArrangement !== 'flexible') {
      systemPrompt += `\n- Work Arrangement Preference: ${userProfile.workArrangement}`;
    }
    if (userProfile.salaryRange) {
      systemPrompt += `\n- Desired Salary Range: ${userProfile.salaryRange}`;
    }
    if (userProfile.industryPreferences && userProfile.industryPreferences.length > 0) {
      systemPrompt += `\n- Industry Preferences: ${userProfile.industryPreferences.join(', ')}`;
    }
    if (userProfile.companySize) {
      systemPrompt += `\n- Preferred Company Size: ${userProfile.companySize}`;
    }
    if (userProfile.careerGoals) {
      systemPrompt += `\n- Career Goals: ${userProfile.careerGoals}`;
    }
    if (userProfile.roleRequirements && userProfile.roleRequirements.length > 0) {
      systemPrompt += `\n- Role Requirements (MUST-HAVES): ${userProfile.roleRequirements.join(', ')}`;
    }
    if (userProfile.dealBreakers && userProfile.dealBreakers.length > 0) {
      systemPrompt += `\n- Deal Breakers: ${userProfile.dealBreakers.join(', ')}`;
    }
    if (userProfile.additionalNotes) {
      systemPrompt += `\n- Additional Notes: ${userProfile.additionalNotes}`;
    }
  } else {
    systemPrompt += `\n- No profile information available. Please evaluate based on general software engineering criteria.`;
  }

  // Add interview summary for richer context
  if (interviewSummary) {
    systemPrompt += `

CAREER NARRATIVE (from personalized AI interview):
${interviewSummary}

This narrative provides deeper context about the candidate's motivations, goals, and ideal work environment. Use it to better understand what truly matters to them beyond the structured profile fields.`;
  }

  // Use custom scoring criteria if provided, otherwise use default from backend
  systemPrompt += `
${scoringCriteria ?? defaultScoringCriteria ?? ''}`;

  return systemPrompt;
}

/**
 * Repair malformed JSON from Chrome AI responses
 * Based on the gemini-extension-example implementation
 */
function repairStructuredJson(rawText: string): string {
  if (typeof rawText !== 'string') {
    return rawText;
  }

  // Remove markdown code blocks
  let cleaned = rawText
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .replace(/\u200b/g, '')
    .trim();

  // Extract JSON candidate (content between first { and last })
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return cleaned;
  }
  const candidate = cleaned.slice(start, end + 1).trim();

  // Try to parse
  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    // Remove trailing commas
    const withoutTrailingCommas = candidate.replace(/,\s*(\]|})/g, '$1');
    try {
      JSON.parse(withoutTrailingCommas);
      return withoutTrailingCommas;
    } catch {
      // Try structural fixes
      let normalized = withoutTrailingCommas.trim();
      const firstBrace = normalized.indexOf('{');
      if (firstBrace > 0) {
        normalized = normalized.slice(firstBrace);
      }
      normalized = normalized.replace(/}\s*,\s*$/g, '}');
      if (!normalized.endsWith('}')) {
        normalized = `${normalized}}`;
      }
      return normalized;
    }
  }
}

/**
 * Score a job using local Chrome AI with structured output
 * Returns the stream result for real-time UI updates
 */
export async function scoreJobWithLocalAI(
  job: LinkedInJobDetailsPayload,
  userProfile: Doc<'userProfiles'> | null,
  interviewSummary?: string | null,
  scoringCriteria?: string | null,
  defaultScoringCriteria?: string | null,
  signal?: AbortSignal
): Promise<StreamResult> {
  const chromeModel = createChromeAIModel();
  const systemPrompt = buildSystemPrompt(userProfile, interviewSummary, scoringCriteria, defaultScoringCriteria);
  const jobText = buildJobText(job);

  // Note: AI SDK warnings are preserved for better debugging
  // If specific warnings become too noisy, consider configuring
  // the AI SDK client's logger options instead of global suppression

  // Build prompt - include requirement checks if user has role requirements
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

  // Use streamObject with JSON repair for better compatibility with Chrome AI
  const streamResult = await streamObject({
    model: chromeModel as any,
    schema: jobScoringSchema,
    system: systemPrompt,
    prompt: evaluationPrompt,
    mode: 'json',
    temperature: 0.3,
    // Note: topK may not be supported by all models, omitted to prevent warnings
    experimental_repairText: async ({ text }) => repairStructuredJson(text),
    abortSignal: signal,
  });

  // Suppress promise rejections for optional fields
  void streamResult.warnings.catch(() => undefined);
  void streamResult.usage.catch(() => undefined);
  void streamResult.response.catch(() => undefined);
  void streamResult.providerMetadata.catch(() => undefined);
  void streamResult.finishReason.catch(() => undefined);

  // Convert AI SDK stream to AsyncGenerator to match StreamResult interface
  async function* convertToAsyncGenerator(): AsyncGenerator<Partial<JobScoringResult>, void, unknown> {
    for await (const partial of streamResult.partialObjectStream) {
      yield partial as Partial<JobScoringResult>;
    }
  }

  // Return the StreamResult interface - caller will iterate over partialObjectStream
  return {
    partialObjectStream: convertToAsyncGenerator(),
  };
}
