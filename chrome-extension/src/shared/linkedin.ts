export type LinkedInJobSection = {
  heading: string;
  items?: string[];
  content?: string;
};

export type LinkedInJobPoster = {
  name?: string | null;
  title?: string | null;
  profileUrl?: string | null;
};

export type LinkedInJobDetailsPayload = {
  jobId?: string | null;
  jobUrl: string;
  canonicalUrl?: string | null;
  capturedAt: number;
  layoutVariant?: string;
  title?: string | null;
  companyName?: string | null;
  companyUrl?: string | null;
  companyLogo?: string | null;
  location?: string | null;
  postedAt?: string | null;
  applicantsCount?: string | null;
  employmentType?: string | null;
  workplaceType?: string | null;
  badges: string[];
  descriptionHtml?: string | null;
  descriptionText?: string | null;
  responsibilities: string[];
  qualifications: string[];
  contractDetails: string[];
  additionalSections: LinkedInJobSection[];
  companyIndustry?: string | null;
  companySize?: string | null;
  companyLinkedInCount?: string | null;
  companyDescriptionHtml?: string | null;
  companyDescriptionText?: string | null;
  jobPoster?: LinkedInJobPoster | null;
  applyUrl?: string | null;
  warnings: string[];
  rawHtml?: string | null;
};

export const normalizeWhitespace = (input: string | null | undefined): string | null => {
  if (!input) {
    return null;
  }
  return input.replace(/\s+/g, " ").trim() || null;
};

export type LinkedInBasicJobInfo = {
  title: string | null;
  company: string | null;
  location: string | null;
};
