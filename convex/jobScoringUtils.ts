import type { Doc } from "./_generated/dataModel";
import { DEFAULT_SCORING_CRITERIA } from "../lib/constants";
import { z } from "zod";
import { jobScoringSchema, type JobScoringResult } from "../lib/schemas/jobScoring";

export type JobScoringProfile = Doc<"userProfiles"> | null;

export type JobScoringInterviewSummary = string | null | undefined;

export function buildSystemPrompt({
  userProfile,
  interviewSummary,
  scoringCriteria = DEFAULT_SCORING_CRITERIA,
}: {
  userProfile: JobScoringProfile;
  interviewSummary: JobScoringInterviewSummary;
  scoringCriteria?: string | null;
}): string {
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
      systemPrompt += `\n- Skills: ${userProfile.skills.join(", ")}`;
    }
    if (userProfile.preferredLocation) {
      systemPrompt += `\n- Preferred Location: ${userProfile.preferredLocation}`;
    }
    if (userProfile.workArrangement && userProfile.workArrangement !== "flexible") {
      systemPrompt += `\n- Work Arrangement Preference: ${userProfile.workArrangement}`;
    }
    if (userProfile.salaryRange) {
      systemPrompt += `\n- Desired Salary Range: ${userProfile.salaryRange}`;
    }
    if (userProfile.industryPreferences && userProfile.industryPreferences.length > 0) {
      systemPrompt += `\n- Industry Preferences: ${userProfile.industryPreferences.join(", ")}`;
    }
    if (userProfile.companySize) {
      systemPrompt += `\n- Preferred Company Size: ${userProfile.companySize}`;
    }
    if (userProfile.careerGoals) {
      systemPrompt += `\n- Career Goals: ${userProfile.careerGoals}`;
    }
    if (userProfile.roleRequirements && userProfile.roleRequirements.length > 0) {
      systemPrompt += `\n- Role Requirements (MUST-HAVES): ${userProfile.roleRequirements.join(", ")}`;
    }
    if (userProfile.dealBreakers && userProfile.dealBreakers.length > 0) {
      systemPrompt += `\n- Deal Breakers: ${userProfile.dealBreakers.join(", ")}`;
    }
    if (userProfile.additionalNotes) {
      systemPrompt += `\n- Additional Notes: ${userProfile.additionalNotes}`;
    }
  } else {
    systemPrompt += `\n- No profile information available. Please evaluate based on general software engineering criteria.`;
  }

  if (interviewSummary) {
    systemPrompt += `

CAREER NARRATIVE (from personalized AI interview):
${interviewSummary}

This narrative provides deeper context about the candidate's motivations, goals, and ideal work environment. Use it to better understand what truly matters to them beyond the structured profile fields.`;
  }

  systemPrompt += `
${scoringCriteria ?? DEFAULT_SCORING_CRITERIA}`;

  return systemPrompt;
}

export type JobDocumentForScoring = Pick<
  Doc<"jobs">,
  | "title"
  | "company"
  | "location"
  | "employmentType"
  | "experienceLevel"
  | "industry"
  | "salary"
  | "companySize"
  | "postedDate"
  | "description"
>;

export function buildJobTextFromJobDocument(job: JobDocumentForScoring): string {
  return `
Job Title: ${job.title}
Company: ${job.company}
Location: ${job.location || "Not specified"}
Employment Type: ${job.employmentType || "Not specified"}
Experience Level: ${job.experienceLevel || "Not specified"}
Industry: ${job.industry || "Not specified"}
Salary: ${job.salary || "Not specified"}
Company Size: ${job.companySize || "Not specified"}
Posted Date: ${job.postedDate || "Not specified"}

Job Description:
${job.description || "No description available"}
  `.trim();
}

export type LinkedInJobDetailsForScoring = {
  title?: string | null;
  companyName?: string | null;
  location?: string | null;
  employmentType?: string | null;
  workplaceType?: string | null;
  postedAt?: string | null;
  applicantsCount?: string | null;
  companySize?: string | null;
  companyIndustry?: string | null;
  descriptionText?: string | null;
  responsibilities?: string[] | null;
  qualifications?: string[] | null;
  companyDescriptionText?: string | null;
};

export function buildJobTextFromLinkedInDetails(details: LinkedInJobDetailsForScoring): string {
  const {
    title,
    companyName,
    location,
    employmentType,
    workplaceType,
    postedAt,
    applicantsCount,
    companySize,
    companyIndustry,
    descriptionText,
    responsibilities,
    qualifications,
    companyDescriptionText,
  } = details;

  const responsibilitiesText =
    responsibilities && responsibilities.length > 0
      ? `\nResponsibilities:\n${responsibilities.map((item) => `- ${item}`).join("\n")}`
      : "";
  const qualificationsText =
    qualifications && qualifications.length > 0
      ? `\nQualifications:\n${qualifications.map((item) => `- ${item}`).join("\n")}`
      : "";
  const companyDescription =
    companyDescriptionText && companyDescriptionText.length > 0
      ? `\nAbout the Company:\n${companyDescriptionText}`
      : "";

  return `
Job Title: ${title || "Not specified"}
Company: ${companyName || "Not specified"}
Location: ${location || "Not specified"}
Employment Type: ${employmentType || "Not specified"}
Workplace Type: ${workplaceType || "Not specified"}
Posted: ${postedAt || "Not specified"}
Applicants: ${applicantsCount || "Not specified"}
Company Size: ${companySize || "Not specified"}
Company Industry: ${companyIndustry || "Not specified"}

Job Description:
${descriptionText || "No description available"}
${responsibilitiesText}${qualificationsText}${companyDescription}
  `.trim();
}

export function repairStructuredJson(rawText: string): string {
  if (typeof rawText !== "string") {
    return rawText as unknown as string;
  }

  let cleaned = rawText
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .replace(/\u200b/g, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return cleaned;
  }

  const candidate = cleaned.slice(start, end + 1).trim();

  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    const withoutTrailingCommas = candidate.replace(/,\s*(\]|})/g, "$1");
    try {
      JSON.parse(withoutTrailingCommas);
      return withoutTrailingCommas;
    } catch {
      let normalized = withoutTrailingCommas.trim();
      const firstBrace = normalized.indexOf("{");
      if (firstBrace > 0) {
        normalized = normalized.slice(firstBrace);
      }
      normalized = normalized.replace(/}\s*,\s*$/g, "}");
      if (!normalized.endsWith("}")) {
        normalized = `${normalized}}`;
      }
      return normalized;
    }
  }
}

// Re-export from shared schema for backward compatibility
export { jobScoringSchema, type JobScoringResult };
