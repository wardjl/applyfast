import type { Id } from "../_generated/dataModel";
import { parseLinkedInJobUrl } from "../../lib/linkedin";

export const cleanJobText = (text: string | undefined | null): string | undefined => {
  if (!text || typeof text !== "string") return undefined;

  const cleaned = text
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length === 0) return undefined;
  return cleaned.substring(0, 10000);
};

export const extractJobField = (job: any, fieldNames: string[], defaultValue: any = undefined) => {
  for (const fieldName of fieldNames) {
    if (job[fieldName] !== undefined && job[fieldName] !== null && job[fieldName] !== "") {
      return job[fieldName];
    }
  }
  return defaultValue;
};

export const extractSalary = (job: any): string | undefined => {
  const salaryFields = ["salary", "salaryRange", "compensationRange", "pay", "wage"];
  for (const field of salaryFields) {
    if (job[field]) return cleanJobText(job[field]);
  }
  if (job.description && typeof job.description === "string") {
    const salaryMatch = job.description.match(
      /\$[\d,]+(?:\s*-\s*\$?[\d,]+)?(?:\s*(?:per|\/)\s*(?:year|month|hour|yr|mo|hr))?/i,
    );
    if (salaryMatch) return salaryMatch[0];
  }
  return undefined;
};

export function normalizeJobUrl(url: string): string {
  if (!url) return "";

  try {
    const urlObj = new URL(url);
    const base = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
    const currentJobId = urlObj.searchParams.get("currentJobId");
    if (currentJobId) {
      return `${base}?currentJobId=${encodeURIComponent(currentJobId)}`;
    }
    return base;
  } catch {
    const [beforeHash] = url.split("#");
    const [pathPart, query] = beforeHash.split("?");
    if (query) {
      const params = new URLSearchParams(query);
      const currentJobId = params.get("currentJobId");
      if (currentJobId) {
        return `${pathPart}?currentJobId=${encodeURIComponent(currentJobId)}`;
      }
    }
    return pathPart ?? url;
  }
}

export const buildJobDocument = (job: any, scrapeId: Id<"jobScrapes">, userId: Id<"users">) => {
  const urlValue: string = extractJobField(
    job,
    ["url", "jobUrl", "link", "href", "jobLink", "viewJobUrl"],
    "",
  );

  const linkedinMeta = parseLinkedInJobUrl(urlValue);
  const fallbackCanonical = urlValue ? normalizeJobUrl(urlValue) : undefined;
  const canonicalUrl = linkedinMeta?.canonicalUrl ?? (fallbackCanonical || undefined);

  const title =
    cleanJobText(
      extractJobField(job, ["title", "jobTitle", "positionTitle", "position", "name"], "Unknown Title"),
    ) || "Unknown Title";
  const company =
    cleanJobText(
      extractJobField(job, ["company", "companyName", "employer", "organization", "companyTitle"], "Unknown Company"),
    ) || "Unknown Company";

  const applyUrl =
    extractJobField(job, ["applyUrl", "applicationUrl", "applyLink", "applicationLink"], undefined) ||
    (urlValue || undefined);

  return {
    scrapeId,
    userId,
    title,
    company,
    location: cleanJobText(extractJobField(job, ["location", "jobLocation", "workLocation", "address", "city", "place"])),
    description: cleanJobText(
      extractJobField(
        job,
        ["descriptionText", "description", "descriptionHtml", "jobDescription", "details", "summary", "content"],
      ),
    ),
    url: urlValue,
    salary: extractSalary(job),
    employmentType: extractJobField(job, ["employmentType", "jobType", "workType", "type", "schedule"]),
    experienceLevel: extractJobField(job, ["experienceLevel", "seniorityLevel", "level", "experience", "jobLevel"]),
    industry: extractJobField(job, ["industry", "sector", "field", "domain"]),
    companySize: cleanJobText(
      extractJobField(job, ["companySize", "numberOfEmployees", "employees", "size"]),
    ),
    postedDate: cleanJobText(
      extractJobField(job, ["postedDate", "datePosted", "publishedDate", "createdAt", "posted", "date"]),
    ),
    applyUrl,
    selected: false,
    linkedinJobId: linkedinMeta?.jobId,
    linkedinCanonicalUrl: canonicalUrl,
  };
};
