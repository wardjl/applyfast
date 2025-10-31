/**
 * Shared types for job preferences used across frontend and backend
 */

export type JobPreferenceProfile = {
  idealJobTitle?: string;
  skills?: string[];
  experience?: string;
  preferredLocation?: string;
  workArrangement?: "remote" | "hybrid" | "onsite" | "flexible";
  salaryRange?: string;
  industryPreferences?: string[];
  companySize?: string;
  careerGoals?: string;
  roleRequirements?: string[];
  dealBreakers?: string[];
  additionalNotes?: string;
};

/**
 * Utility to check if job preferences are empty (no meaningful data entered)
 * This is the canonical implementation used across frontend and backend
 */
export function isJobPreferencesEmpty(profile: JobPreferenceProfile | null | undefined): boolean {
  if (!profile) {
    return true;
  }

  const meaningfulFields = [
    profile.idealJobTitle?.trim(),
    Array.isArray(profile.skills) && profile.skills.length > 0 ? "skills" : "",
    profile.experience?.trim(),
    profile.preferredLocation?.trim(),
    profile.workArrangement && profile.workArrangement !== "flexible" ? profile.workArrangement : "",
    profile.salaryRange?.trim(),
    Array.isArray(profile.industryPreferences) && profile.industryPreferences.length > 0 ? "industries" : "",
    profile.companySize?.trim(),
    profile.careerGoals?.trim(),
    Array.isArray(profile.roleRequirements) && profile.roleRequirements.length > 0 ? "roleRequirements" : "",
    Array.isArray(profile.dealBreakers) && profile.dealBreakers.length > 0 ? "dealBreakers" : "",
    profile.additionalNotes?.trim(),
  ];

  const filledCount = meaningfulFields.filter(Boolean).length;
  return filledCount === 0;
}
