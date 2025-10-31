export type ParsedLinkedInJob = {
  jobId: string;
  originalUrl: string;
  canonicalUrl: string;
};

const LINKEDIN_ROOT_DOMAIN = "linkedin.com";

const JOB_VIEW_REGEX = /\/jobs\/view\/(?:[A-Za-z0-9\-]+-)?(\d+)(?:\/|$)/;

export const LINKEDIN_JOB_SEARCH_BASE_URL = "https://www.linkedin.com/jobs/search/";
export const DEFAULT_JOB_SEARCH_DISTANCE_KM = 10;
export const DEFAULT_JOB_SEARCH_TIME_RANGE = "r86400";

export type LinkedInJobSearchOptions = {
  keywords?: string;
  location?: string;
  distance?: number;
  timeRange?: string;
};

export type LinkedInJobSearchParseResult = {
  keywords?: string;
  location?: string;
  distance?: number;
  timeRange?: string;
  geoId?: string;
};

function isLinkedInHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return lower === LINKEDIN_ROOT_DOMAIN || lower.endsWith(`.${LINKEDIN_ROOT_DOMAIN}`);
}

export function canonicalizeLinkedInUrl(url: URL): string {
  const trimmedPath = url.pathname.replace(/\/+$/, "");
  const pathname = trimmedPath === "" ? "/" : trimmedPath;
  const base = `${url.protocol}//${url.hostname}${pathname}`;
  const currentJobId = url.searchParams.get("currentJobId");
  if (currentJobId) {
    return `${base}?currentJobId=${encodeURIComponent(currentJobId)}`;
  }
  return base;
}

export function parseLinkedInJobUrl(urlString: string | undefined): ParsedLinkedInJob | null {
  if (!urlString) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }

  if (!isLinkedInHost(url.hostname)) {
    return null;
  }

  const jobViewMatch = JOB_VIEW_REGEX.exec(url.pathname);
  if (jobViewMatch?.[1]) {
    const jobId = jobViewMatch[1];
    return {
      jobId,
      originalUrl: urlString,
      canonicalUrl: canonicalizeLinkedInUrl(url),
    };
  }

  const currentJobId = url.searchParams.get("currentJobId");
  if (currentJobId) {
    return {
      jobId: currentJobId,
      originalUrl: urlString,
      canonicalUrl: canonicalizeLinkedInUrl(url),
    };
  }

  return null;
}

export function buildLinkedInJobSearchUrl({
  keywords,
  location,
  distance,
  timeRange,
}: LinkedInJobSearchOptions = {}): string {
  const url = new URL(LINKEDIN_JOB_SEARCH_BASE_URL);

  // Only add distance and time filters if explicitly provided
  if (distance !== undefined) {
    url.searchParams.set("distance", distance.toString());
  }
  if (timeRange !== undefined) {
    url.searchParams.set("f_TPR", timeRange);
  }

  const trimmedKeywords = keywords?.trim();
  if (trimmedKeywords) {
    url.searchParams.set("keywords", trimmedKeywords);
  }

  const trimmedLocation = location?.trim();
  if (trimmedLocation) {
    url.searchParams.set("location", trimmedLocation);
  }

  return url.toString();
}

export function parseLinkedInJobSearchUrl(
  urlString: string | undefined,
): LinkedInJobSearchParseResult | null {
  if (!urlString) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }

  if (!isLinkedInHost(url.hostname)) {
    return null;
  }

  const keywords = url.searchParams.get("keywords") ?? url.searchParams.get("title") ?? undefined;
  const location = url.searchParams.get("location") ?? undefined;
  const distanceParam = url.searchParams.get("distance");
  const parsedDistance = distanceParam ? Number.parseInt(distanceParam, 10) : undefined;
  const distance = Number.isNaN(parsedDistance) ? undefined : parsedDistance;
  const timeRange = url.searchParams.get("f_TPR") ?? undefined;
  const geoId = url.searchParams.get("geoId") ?? undefined;

  return {
    keywords: keywords ?? undefined,
    location: location ?? undefined,
    distance,
    timeRange,
    geoId: geoId ?? undefined,
  };
}

export function extractLinkedInJobId(urlString: string | undefined): string | null {
  const parsed = parseLinkedInJobUrl(urlString);
  return parsed?.jobId ?? null;
}

export function formatLinkedInJobDisplay(urlString: string): string {
  try {
    const url = new URL(urlString);
    const path = url.pathname.replace(/^\/+/, "");
    return `${url.hostname}/${path}`.replace(/\/$/, "");
  } catch {
    return urlString;
  }
}
