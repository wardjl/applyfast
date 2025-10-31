import { v } from "convex/values";
import {
  query,
  mutation,
  action,
  internalMutation,
  internalAction,
  internalQuery,
  MutationCtx,
} from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { internal, api } from "./_generated/api";
import { generateObject } from "ai";
import { z } from "zod";
import { DEFAULT_SCORING_CRITERIA } from "../lib/constants";
import {
  buildJobTextFromJobDocument,
  buildSystemPrompt,
  jobScoringSchema,
} from "./jobScoringUtils";
import { parseLinkedInJobUrl } from "../lib/linkedin";
import { requireUserId } from "./lib/auth";
import { buildJobDocument, cleanJobText, extractJobField, extractSalary, normalizeJobUrl } from "./jobScraping/helpers";

const APP_BASE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://applyfa.st").replace(/\/$/, "");
const DASHBOARD_ROOT = `${APP_BASE_URL}/dashboard`;
const SCORING_MODEL = process.env.AI_GATEWAY_SCORING_MODEL || "google/gemini-2.5-flash-lite";
const JOB_SCRAPING_DEBUG = process.env.JOB_SCRAPING_DEBUG === "true";

const scrapingLog = (...args: unknown[]) => {
  if (JOB_SCRAPING_DEBUG) {
    scrapingLog(...args);
  }
};

type ManualJobAdditionalSection = {
  heading: string;
  content?: string | null;
  items?: string[] | null;
};

type ManualJobPayload = {
  jobUrl: string;
  title: string;
  company: string;
  linkedinJobId?: string | null;
  linkedinCanonicalUrl?: string | null;
  location?: string | null;
  employmentType?: string | null;
  workplaceType?: string | null;
  postedAt?: string | null;
  applicantsCount?: string | null;
  applyUrl?: string | null;
  companyUrl?: string | null;
  companyLogo?: string | null;
  companyIndustry?: string | null;
  companySize?: string | null;
  companyLinkedInCount?: string | null;
  companyDescriptionHtml?: string | null;
  companyDescriptionText?: string | null;
  descriptionHtml?: string | null;
  descriptionText?: string | null;
  responsibilities?: string[] | null;
  qualifications?: string[] | null;
  contractDetails?: string[] | null;
  additionalSections?: ManualJobAdditionalSection[] | null;
  jobPoster?: {
    name?: string | null;
    title?: string | null;
    profileUrl?: string | null;
  } | null;
  rawHtml?: string | null;
  capturedAt?: number | null;
  badges?: string[] | null;
  warnings?: string[] | null;
  // Pre-computed AI scores from local AI
  aiScore?: number | null;
  aiDescription?: string | null;
  aiRequirementChecks?: Array<{
    requirement: string;
    score: number;
  }> | null;
};

const toOptionalCleanText = (value: string | null | undefined): string | undefined => {
  if (!value || typeof value !== "string") {
    return undefined;
  }
  return cleanJobText(value);
};

const buildManualRawData = (
  payload: ManualJobPayload,
  capturedAt: number,
  canonicalUrl?: string,
) => {
  return {
    capturedAt,
    jobUrl: payload.jobUrl,
    linkedinJobId: payload.linkedinJobId ?? null,
    linkedinCanonicalUrl: canonicalUrl ?? null,
    title: payload.title,
    companyName: payload.company,
    location: payload.location ?? null,
    employmentType: payload.employmentType ?? null,
    workplaceType: payload.workplaceType ?? null,
    postedAt: payload.postedAt ?? null,
    applicantsCount: payload.applicantsCount ?? null,
    descriptionHtml: payload.descriptionHtml ?? null,
    descriptionText: payload.descriptionText ?? null,
    responsibilities: payload.responsibilities ?? null,
    qualifications: payload.qualifications ?? null,
    contractDetails: payload.contractDetails ?? null,
    additionalSections: payload.additionalSections ?? null,
    companyProfile: {
      url: payload.companyUrl ?? null,
      logo: payload.companyLogo ?? null,
      industry: payload.companyIndustry ?? null,
      sizeLabel: payload.companySize ?? null,
      linkedinCount: payload.companyLinkedInCount ?? null,
      descriptionHtml: payload.companyDescriptionHtml ?? null,
      descriptionText: payload.companyDescriptionText ?? null,
    },
    jobPoster: payload.jobPoster ?? null,
    badges: payload.badges ?? null,
    warnings: payload.warnings ?? null,
    applyUrl: payload.applyUrl ?? null,
    snapshotHtml: payload.rawHtml ?? null,
  };
};

const ensureManualScrape = async (ctx: MutationCtx, userId: Id<"users">, timestamp: number) => {
  const manualScrape = await ctx.db
    .query("jobScrapes")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("isManual"), true))
    .take(1);

  if (manualScrape.length > 0) {
    const scrape = manualScrape[0];
    if (!scrape.completedAt || scrape.completedAt < timestamp) {
      await ctx.db.patch(scrape._id, { completedAt: timestamp });
    }
    return scrape;
  }

  const createdAt = timestamp || Date.now();
  const scrapeId = await ctx.db.insert("jobScrapes", {
    name: "Manual search",
    status: "completed",
    totalJobs: 0,
    totalJobsToScore: 0,
    jobsScored: 0,
    userId,
    createdAt,
    completedAt: createdAt,
    isManual: true,
  });

  const scrape = await ctx.db.get(scrapeId);
  if (!scrape) {
    throw new Error("Failed to create manual scrape");
  }
  return scrape;
};

const findExistingJobForUser = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  identifiers: { linkedinJobId?: string; canonicalUrl?: string; url?: string },
): Promise<Doc<"jobs"> | null> => {
  const candidateMap = new Map<string, Doc<"jobs">>();

  if (identifiers.linkedinJobId) {
    const matches = await ctx.db
      .query("jobs")
      .withIndex("by_user_linkedin_job_id", (q) =>
        q.eq("userId", userId).eq("linkedinJobId", identifiers.linkedinJobId!),
      )
      .take(5);

    for (const job of matches) {
      candidateMap.set(job._id, job);
    }
  }

  const normalizedCanonical = identifiers.canonicalUrl ? normalizeJobUrl(identifiers.canonicalUrl) : undefined;
  if (normalizedCanonical) {
    const matches = await ctx.db
      .query("jobs")
      .withIndex("by_user_linkedin_url", (q) =>
        q.eq("userId", userId).eq("linkedinCanonicalUrl", normalizedCanonical),
      )
      .take(5);

    for (const job of matches) {
      candidateMap.set(job._id, job);
    }
  }

  const urlCandidates = new Set<string>();
  if (identifiers.url) {
    urlCandidates.add(identifiers.url);
    urlCandidates.add(normalizeJobUrl(identifiers.url));
  }
  if (normalizedCanonical) {
    urlCandidates.add(normalizedCanonical);
  }

  for (const candidateUrl of urlCandidates) {
    if (!candidateUrl) continue;

    const matches = await ctx.db
      .query("jobs")
      .withIndex("by_url", (q) => q.eq("url", candidateUrl))
      .take(5);

    for (const job of matches) {
      candidateMap.set(job._id, job);
    }
  }

  const candidates = Array.from(candidateMap.values()).sort(
    (a, b) => b._creationTime - a._creationTime,
  );

  for (const job of candidates) {
    if (job.userId === userId) {
      return job;
    }

    const owningScrape = await ctx.db.get(job.scrapeId);
    if (owningScrape?.userId === userId) {
      return job;
    }
  }

  return null;
};

export const createManualLinkedinJob = mutation({
  args: {
    job: v.object({
      jobUrl: v.string(),
      title: v.string(),
      company: v.string(),
      linkedinJobId: v.optional(v.string()),
      linkedinCanonicalUrl: v.optional(v.string()),
      location: v.optional(v.string()),
      employmentType: v.optional(v.string()),
      workplaceType: v.optional(v.string()),
      postedAt: v.optional(v.string()),
      applicantsCount: v.optional(v.string()),
      applyUrl: v.optional(v.string()),
      companyUrl: v.optional(v.string()),
      companyLogo: v.optional(v.string()),
      companyIndustry: v.optional(v.string()),
      companySize: v.optional(v.string()),
      companyLinkedInCount: v.optional(v.string()),
      companyDescriptionHtml: v.optional(v.string()),
      companyDescriptionText: v.optional(v.string()),
      descriptionHtml: v.optional(v.string()),
      descriptionText: v.optional(v.string()),
      responsibilities: v.optional(v.array(v.string())),
      qualifications: v.optional(v.array(v.string())),
      contractDetails: v.optional(v.array(v.string())),
      additionalSections: v.optional(
        v.array(
          v.object({
            heading: v.string(),
            content: v.optional(v.string()),
            items: v.optional(v.array(v.string())),
          }),
        ),
      ),
      jobPoster: v.optional(
        v.object({
          name: v.optional(v.string()),
          title: v.optional(v.string()),
          profileUrl: v.optional(v.string()),
        }),
      ),
      rawHtml: v.optional(v.string()),
      capturedAt: v.optional(v.number()),
      badges: v.optional(v.array(v.string())),
      warnings: v.optional(v.array(v.string())),
      // Pre-computed AI scores from local AI
      aiScore: v.optional(v.number()),
      aiDescription: v.optional(v.string()),
      aiRequirementChecks: v.optional(v.array(v.object({
        requirement: v.string(),
        score: v.number(),
      }))),
    }),
    // Skip expensive lookup queries when caller has already verified job doesn't exist
    skipExistingCheck: v.optional(v.boolean()),
  },
  returns: v.object({
    jobId: v.id("jobs"),
    scrapeId: v.id("jobScrapes"),
    wasCreated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
const payload = args.job as ManualJobPayload;
    const skipExistingCheck = args.skipExistingCheck ?? false;

    const now = Date.now();
    const capturedAt = payload.capturedAt ?? now;

    const parsedMeta = parseLinkedInJobUrl(payload.jobUrl);
    const computedJobId = payload.linkedinJobId ?? parsedMeta?.jobId ?? null;
    const canonicalCandidate = payload.linkedinCanonicalUrl ?? parsedMeta?.canonicalUrl ?? null;
    const canonicalNormalized = canonicalCandidate ? normalizeJobUrl(canonicalCandidate) : undefined;

    // Skip expensive lookup if caller has already verified job doesn't exist
    const existingJob = skipExistingCheck
      ? null
      : await findExistingJobForUser(ctx, userId, {
          linkedinJobId: computedJobId ?? undefined,
          canonicalUrl: canonicalNormalized,
          url: payload.jobUrl,
        });

    const manualRawData = buildManualRawData(payload, capturedAt, canonicalNormalized);

    if (existingJob) {
      const patchData: Partial<Doc<"jobs">> = {
        manualCapture: true,
        manualCapturedAt: capturedAt,
        manualCapturedBy: userId,
      };

      const sanitizedTitle = cleanJobText(payload.title) ?? existingJob.title;
      const sanitizedCompany = cleanJobText(payload.company) ?? existingJob.company;
      patchData.title = sanitizedTitle;
      patchData.company = sanitizedCompany;

      const sanitizedLocation = toOptionalCleanText(payload.location);
      if (sanitizedLocation !== undefined) {
        patchData.location = sanitizedLocation;
      }

      const sanitizedDescription =
        toOptionalCleanText(payload.descriptionText) ?? toOptionalCleanText(payload.descriptionHtml);
      if (sanitizedDescription !== undefined) {
        patchData.description = sanitizedDescription;
      }

      patchData.url = payload.jobUrl;
      if (payload.applyUrl) {
        patchData.applyUrl = payload.applyUrl;
      } else if (!existingJob.applyUrl) {
        patchData.applyUrl = payload.jobUrl;
      }

      const sanitizedEmploymentType = toOptionalCleanText(payload.employmentType);
      if (sanitizedEmploymentType !== undefined) {
        patchData.employmentType = sanitizedEmploymentType;
      }

      const sanitizedIndustry = toOptionalCleanText(payload.companyIndustry);
      if (sanitizedIndustry !== undefined) {
        patchData.industry = sanitizedIndustry;
      }

      const sanitizedCompanySize = toOptionalCleanText(payload.companySize);
      if (sanitizedCompanySize !== undefined) {
        patchData.companySize = sanitizedCompanySize;
      }

      const sanitizedPostedDate = toOptionalCleanText(payload.postedAt);
      if (sanitizedPostedDate !== undefined) {
        patchData.postedDate = sanitizedPostedDate;
      }

      if (computedJobId && existingJob.linkedinJobId !== computedJobId) {
        patchData.linkedinJobId = computedJobId;
      }

      if (canonicalNormalized && existingJob.linkedinCanonicalUrl !== canonicalNormalized) {
        patchData.linkedinCanonicalUrl = canonicalNormalized;
      }

      const mergedRawData = {
        ...(existingJob.rawData ?? {}),
        manualCapture: manualRawData,
      };
      patchData.rawData = mergedRawData;

      await ctx.db.patch(existingJob._id, patchData);

      // If pre-computed AI scores were provided (from local AI), save them
      if (payload.aiScore !== undefined && payload.aiScore !== null && payload.aiDescription) {
        await ctx.db.patch(existingJob._id, {
          aiScore: payload.aiScore,
          aiDescription: payload.aiDescription,
          aiRequirementChecks: payload.aiRequirementChecks ?? undefined,
          aiScoredAt: Date.now(),
        });
      }

      return {
        jobId: existingJob._id,
        scrapeId: existingJob.scrapeId,
        wasCreated: false,
      };
    }

    const manualScrape = await ensureManualScrape(ctx, userId, capturedAt);

    const sanitizedTitle = cleanJobText(payload.title) ?? "Untitled role";
    const sanitizedCompany = cleanJobText(payload.company) ?? "Unknown company";
    const sanitizedLocation = toOptionalCleanText(payload.location);
    const sanitizedDescription =
      toOptionalCleanText(payload.descriptionText) ?? toOptionalCleanText(payload.descriptionHtml);
    const sanitizedEmploymentType = toOptionalCleanText(payload.employmentType);
    const sanitizedIndustry = toOptionalCleanText(payload.companyIndustry);
    const sanitizedCompanySize = toOptionalCleanText(payload.companySize);
    const sanitizedPostedDate = toOptionalCleanText(payload.postedAt);

    const newJob: Partial<Doc<"jobs">> & {
      scrapeId: Id<"jobScrapes">;
      userId: Id<"users">;
      title: string;
      company: string;
      url: string;
      selected: boolean;
      rawData: any;
      manualCapture: boolean;
      manualCapturedAt: number;
      manualCapturedBy: Id<"users">;
    } = {
      scrapeId: manualScrape._id,
      userId,
      title: sanitizedTitle,
      company: sanitizedCompany,
      url: payload.jobUrl,
      selected: false,
      rawData: {
        source: "manual_linkedin",
        ...manualRawData,
      },
      manualCapture: true,
      manualCapturedAt: capturedAt,
      manualCapturedBy: userId,
    };

    if (sanitizedLocation !== undefined) newJob.location = sanitizedLocation;
    if (sanitizedDescription !== undefined) newJob.description = sanitizedDescription;
    if (sanitizedEmploymentType !== undefined) newJob.employmentType = sanitizedEmploymentType;
    if (sanitizedIndustry !== undefined) newJob.industry = sanitizedIndustry;
    if (sanitizedCompanySize !== undefined) newJob.companySize = sanitizedCompanySize;
    if (sanitizedPostedDate !== undefined) newJob.postedDate = sanitizedPostedDate;
    newJob.applyUrl = payload.applyUrl ?? payload.jobUrl;
    if (computedJobId) newJob.linkedinJobId = computedJobId;
    if (canonicalNormalized) newJob.linkedinCanonicalUrl = canonicalNormalized;

    const insertedJobId = await ctx.db.insert("jobs", newJob);

    // If pre-computed AI scores were provided (from local AI), save them
    if (payload.aiScore !== undefined && payload.aiScore !== null && payload.aiDescription) {
      await ctx.db.patch(insertedJobId, {
        aiScore: payload.aiScore,
        aiDescription: payload.aiDescription,
        aiRequirementChecks: payload.aiRequirementChecks ?? undefined,
        aiScoredAt: Date.now(),
      });
    }

    await ctx.db.patch(manualScrape._id, {
      totalJobs: (manualScrape.totalJobs ?? 0) + 1,
      totalJobsToScore: (manualScrape.totalJobsToScore ?? 0) + 1,
      completedAt: capturedAt,
    });

    return {
      jobId: insertedJobId,
      scrapeId: manualScrape._id,
      wasCreated: true,
    };
  },
});

// Query to list all job scrapes for the current user
export const listJobScrapes = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
return await ctx.db
      .query("jobScrapes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

// Query to get jobs for a specific scrape
export const getJobsByScrape = query({
  args: {
    scrapeId: v.id("jobScrapes"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
// Verify user owns this scrape
    const scrape = await ctx.db.get(args.scrapeId);
    if (!scrape || scrape.userId !== userId) {
      throw new Error("Access denied");
    }

    return await ctx.db
      .query("jobs")
      .withIndex("by_scrape", (q) => q.eq("scrapeId", args.scrapeId))
      .collect();
  },
});

// Internal query to get today's high-scoring jobs for a user (score > 6, created today)
export const getTodaysHighScoringJobsForUser = internalQuery({
  args: {
    userId: v.id("users"),
    scrapeId: v.optional(v.id("jobScrapes")), // Optional: filter by specific scrape
  },
  handler: async (ctx, args) => {
    // Get start and end of today in milliseconds
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = startOfToday + (24 * 60 * 60 * 1000) - 1;

    // Determine which scrapes to query
    let scrapeIdsToQuery: Id<"jobScrapes">[];

    if (args.scrapeId) {
      // If scrapeId is provided, only query that specific scrape
      // First verify it belongs to the user
      const scrape = await ctx.db.get(args.scrapeId);
      if (!scrape || scrape.userId !== args.userId) {
        return []; // Scrape doesn't exist or doesn't belong to user
      }
      scrapeIdsToQuery = [args.scrapeId];
    } else {
      // Get all user's scrapes to find which jobs belong to this user
      const userScrapes = await ctx.db
        .query("jobScrapes")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();

      if (userScrapes.length === 0) {
        return [];
      }

      scrapeIdsToQuery = userScrapes.map(scrape => scrape._id);
    }

    // Get all jobs created today that belong to this user and have high AI scores
    const allJobs = [];
    for (const scrapeId of scrapeIdsToQuery) {
      const jobs = await ctx.db
        .query("jobs")
        .withIndex("by_scrape", (q) => q.eq("scrapeId", scrapeId))
        .filter((q) =>
          q.and(
            q.gte(q.field("_creationTime"), startOfToday),
            q.lte(q.field("_creationTime"), endOfToday),
            q.gt(q.field("aiScore"), 6)
          )
        )
        .collect();

      allJobs.push(...jobs);
    }

    // Return only the fields needed for email: title, company, url, aiScore, applyUrl
    return allJobs.map(job => ({
      _id: job._id,
      title: job.title,
      company: job.company,
      url: job.url,
      aiScore: job.aiScore!,
      scrapeId: job.scrapeId,
      applyUrl: job.applyUrl,
    }));
  },
});

// Mutation to create a new job scrape
export const createJobScrape = mutation({
  args: {
    name: v.string(),
    linkedinUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
const scrapeId = await ctx.db.insert("jobScrapes", {
      name: args.name,
      linkedinUrl: args.linkedinUrl,
      status: "pending",
      userId,
      createdAt: Date.now(),
    });

    // Schedule the scraping action
    await ctx.scheduler.runAfter(0, internal.jobScraping.runApifyJobScrape, {
      scrapeId,
      linkedinUrl: args.linkedinUrl,
    });

    return scrapeId;
  },
});

// Internal action to run the Apify scraping
export const runApifyJobScrape = internalAction({
  args: {
    scrapeId: v.id("jobScrapes"),
    linkedinUrl: v.string(),
  },
  handler: async (ctx, args) => {
    // Run the actual Apify scraping in a Node.js action
    await ctx.runAction(internal.apifyActions.executeApifyScrape, args);
  },
});

// Internal mutation to update scrape status
export const updateScrapeStatus = internalMutation({
  args: {
    scrapeId: v.id("jobScrapes"),
    status: v.union(v.literal("pending"), v.literal("running"), v.literal("completed"), v.literal("scoring"), v.literal("failed")),
    totalJobs: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { scrapeId, ...updates } = args;
    await ctx.db.patch(scrapeId, updates);
  },
});

// Internal mutation to update scrape with run ID
export const updateScrapeRunId = internalMutation({
  args: {
    scrapeId: v.id("jobScrapes"),
    apifyRunId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scrapeId, {
      apifyRunId: args.apifyRunId,
    });
  },
});

// Internal mutation to save a job from Apify response
export const saveJob = internalMutation({
  args: {
    scrapeId: v.id("jobScrapes"),
    jobData: v.any(),
  },
  handler: async (ctx, args) => {
    const scrape = await ctx.db.get(args.scrapeId);
    if (!scrape) {
      throw new Error("Scrape not found");
    }

    const jobDoc = buildJobDocument(args.jobData, args.scrapeId, scrape.userId);
    await ctx.db.insert("jobs", jobDoc);
  },
});

// Internal mutation to save multiple jobs from Apify response with URL deduplication
export const saveJobsBatch = internalMutation({
  args: {
    scrapeId: v.id("jobScrapes"),
    jobsData: v.array(v.any()),
    userId: v.id("users"),
  },
  returns: v.object({
    newJobsCount: v.number(),
    duplicatesSkipped: v.number(),
    totalProcessed: v.number(),
  }),
  handler: async (ctx, args) => {
    const scrapeId = args.scrapeId;
    const jobsData = args.jobsData;
    const userId = args.userId;

    scrapingLog(`Processing ${jobsData.length} jobs from Apify for deduplication`);

    // Get all existing job URLs for this user to check for duplicates
    const userScrapes = await ctx.db
      .query("jobScrapes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const userScrapeIds = userScrapes.map(scrape => scrape._id);

    // Get all existing URLs for this user's jobs
    const existingJobs = await ctx.db
      .query("jobs")
      .filter((q) => q.or(...userScrapeIds.map(id => q.eq(q.field("scrapeId"), id))))
      .collect();

    const existingUrls = new Set(
      existingJobs
        .map(job => normalizeJobUrl(job.url))
        .filter(url => url !== "")
    );

    scrapingLog(`Found ${existingUrls.size} existing job URLs for user`);

    // Process jobs and filter out duplicates
    const jobsToSave = [];
    const seenUrlsInBatch = new Set();
    let duplicatesSkipped = 0;

    for (const jobData of jobsData) {
      // Extract and normalize URL first
      const rawUrl = extractJobField(jobData, [
        'url', 'jobUrl', 'link', 'href', 'jobLink', 'viewJobUrl'
      ], "");

      const normalizedUrl = normalizeJobUrl(rawUrl);

      // Skip if no URL or empty URL
      if (!normalizedUrl) {
        scrapingLog(`Skipping job with no URL: ${extractJobField(jobData, ['title', 'jobTitle'], 'Unknown')}`);
        duplicatesSkipped++;
        continue;
      }

      // Check if URL already exists in database
      if (existingUrls.has(normalizedUrl)) {
        scrapingLog(`Skipping duplicate job (exists in DB): ${normalizedUrl}`);
        duplicatesSkipped++;
        continue;
      }

      // Check if URL already seen in current batch
      if (seenUrlsInBatch.has(normalizedUrl)) {
        scrapingLog(`Skipping duplicate job (in current batch): ${normalizedUrl}`);
        duplicatesSkipped++;
        continue;
      }

      // Mark URL as seen and prepare job for saving
      seenUrlsInBatch.add(normalizedUrl);
      jobsToSave.push(buildJobDocument(jobData, scrapeId, userId));
    }

    scrapingLog(`Saving ${jobsToSave.length} new jobs, skipped ${duplicatesSkipped} duplicates`);

    // Batch insert all new jobs
    for (const jobToSave of jobsToSave) {
      await ctx.db.insert("jobs", jobToSave);
    }

    return {
      newJobsCount: jobsToSave.length,
      duplicatesSkipped: duplicatesSkipped,
      totalProcessed: jobsData.length,
    };
  },
});

export const backfillLinkedInJobMetadata = internalMutation({
  args: {
    userId: v.id("users"),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    patched: v.number(),
    remainingRequested: v.number(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;
    const userScrapes = await ctx.db
      .query("jobScrapes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    let patched = 0;

    for (const scrape of userScrapes) {
      if (patched >= batchSize) break;

      const jobs = await ctx.db
        .query("jobs")
        .withIndex("by_scrape", (q) => q.eq("scrapeId", scrape._id))
        .collect();

      for (const job of jobs) {
        if (patched >= batchSize) {
          break;
        }

        const needsUser = !job.userId;
        const needsJobId = !job.linkedinJobId;
        const needsCanonical = !job.linkedinCanonicalUrl;

        if (!needsUser && !needsJobId && !needsCanonical) {
          continue;
        }

        const urlCandidate = job.url ?? job.applyUrl ?? undefined;
        const linkedinMeta = parseLinkedInJobUrl(urlCandidate);
        const canonical = linkedinMeta?.canonicalUrl ?? (urlCandidate ? normalizeJobUrl(urlCandidate) : undefined);

        const updates: Record<string, any> = {};
        if (needsUser) {
          updates.userId = args.userId;
        }
        if (needsJobId && linkedinMeta?.jobId) {
          updates.linkedinJobId = linkedinMeta.jobId;
        }
        if (needsCanonical && canonical) {
          updates.linkedinCanonicalUrl = canonical;
        }

        if (Object.keys(updates).length === 0) {
          continue;
        }

        await ctx.db.patch(job._id, updates);
        patched += 1;
      }
    }

    return {
      patched,
      remainingRequested: Math.max(batchSize - patched, 0),
    };
  },
});

// Mutation to toggle job selection (for AI processing later)
export const toggleJobSelection = mutation({
  args: {
    jobId: v.id("jobs"),
    selected: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    // Verify user owns the scrape this job belongs to
    const scrape = await ctx.db.get(job.scrapeId);
    if (!scrape || scrape.userId !== userId) {
      throw new Error("Access denied");
    }

    await ctx.db.patch(args.jobId, {
      selected: args.selected,
    });
  },
});

// Query to get a specific job scrape
export const getJobScrape = query({
  args: {
    scrapeId: v.id("jobScrapes"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
const scrape = await ctx.db.get(args.scrapeId);
    if (!scrape || scrape.userId !== userId) {
      throw new Error("Access denied");
    }

    return scrape;
  },
});

// Mutation to delete a job scrape and all its jobs
export const deleteJobScrape = mutation({
  args: {
    scrapeId: v.id("jobScrapes"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
const scrape = await ctx.db.get(args.scrapeId);
    if (!scrape || scrape.userId !== userId) {
      throw new Error("Access denied");
    }

    // Delete all jobs associated with this scrape
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_scrape", (q) => q.eq("scrapeId", args.scrapeId))
      .collect();

    for (const job of jobs) {
      await ctx.db.delete(job._id);
    }

    // Delete the scrape
    await ctx.db.delete(args.scrapeId);
  },
});

// Mutation to delete a single job
export const deleteJob = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    // Verify user owns the scrape this job belongs to
    const scrape = await ctx.db.get(job.scrapeId);
    if (!scrape || scrape.userId !== userId) {
      throw new Error("Access denied");
    }

    // Delete the job
    await ctx.db.delete(args.jobId);
  },
});

// Internal mutation to create a job scrape from a recurring job scrape
export const createJobScrapeFromRecurring = internalMutation({
  args: {
    name: v.string(),
    linkedinUrl: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const scrapeId = await ctx.db.insert("jobScrapes", {
      name: args.name,
      linkedinUrl: args.linkedinUrl,
      status: "pending",
      userId: args.userId,
      createdAt: Date.now(),
    });

    return scrapeId;
  },
});

// Internal query to get scrape by ID (for email notifications)
export const getScrapeById = internalQuery({
  args: {
    scrapeId: v.id("jobScrapes"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.scrapeId);
  },
});

// Query to search and filter jobs across all user's scrapes
export const searchJobs = query({
  args: {
    scrapeId: v.optional(v.string()),
    keywords: v.optional(v.string()),
    location: v.optional(v.string()),
    company: v.optional(v.string()),
    hideDuplicates: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
// Get all user's scrapes to filter jobs
    const userScrapes = await ctx.db
      .query("jobScrapes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const userScrapeIds = userScrapes.map(scrape => scrape._id);

    let jobs;

    // If specific scrape ID is provided, filter by it (after validating ownership)
    if (args.scrapeId && args.scrapeId !== "all") {
      const scrape = userScrapes.find(s => s._id === args.scrapeId);
      if (!scrape) {
        throw new Error("Access denied");
      }
      jobs = await ctx.db
        .query("jobs")
        .withIndex("by_scrape", (q) => q.eq("scrapeId", args.scrapeId as any))
        .collect();
    } else {
      jobs = await ctx.db.query("jobs").collect();
    }

    // Filter to only jobs from user's scrapes (if no specific scrape was selected)
    if (!args.scrapeId || args.scrapeId === "all") {
      jobs = jobs.filter(job => userScrapeIds.includes(job.scrapeId));
    }

    // Apply text-based filters
    if (args.keywords) {
      const keywords = args.keywords.toLowerCase();
      jobs = jobs.filter(job =>
        job.title.toLowerCase().includes(keywords) ||
        job.company.toLowerCase().includes(keywords) ||
        (job.description && job.description.toLowerCase().includes(keywords)) ||
        (job.industry && job.industry.toLowerCase().includes(keywords)) ||
        (job.employmentType && job.employmentType.toLowerCase().includes(keywords))
      );
    }

    if (args.location) {
      const location = args.location.toLowerCase();
      jobs = jobs.filter(job =>
        job.location && job.location.toLowerCase().includes(location)
      );
    }

    if (args.company) {
      const company = args.company.toLowerCase();
      jobs = jobs.filter(job =>
        job.company.toLowerCase().includes(company)
      );
    }

    // Apply duplicate filtering if requested
    if (args.hideDuplicates) {
      const urlGroups: { [baseUrl: string]: typeof jobs } = {};

      // Group jobs by base URL (without query parameters)
      for (const job of jobs) {
        if (job.url) {
          const baseUrl = job.url.split('?')[0];
          if (!urlGroups[baseUrl]) {
            urlGroups[baseUrl] = [];
          }
          urlGroups[baseUrl].push(job);
        } else {
          // For jobs without URLs, use a combination of title + company as identifier
          const identifier = `no-url:${job.title}:${job.company}`;
          if (!urlGroups[identifier]) {
            urlGroups[identifier] = [];
          }
          urlGroups[identifier].push(job);
        }
      }

      // For each group, keep only the most recently scraped job
      jobs = Object.values(urlGroups).map(jobGroup => {
        // Sort by creation time (most recent first) and return the first one
        return jobGroup.sort((a, b) => b._creationTime - a._creationTime)[0];
      });
    }

    // Return lightweight job objects for list views (exclude heavy fields)
    return jobs.map(job => ({
      _id: job._id,
      _creationTime: job._creationTime,
      scrapeId: job.scrapeId,
      userId: job.userId,
      title: job.title,
      company: job.company,
      location: job.location,
      url: job.url,
      salary: job.salary,
      employmentType: job.employmentType,
      experienceLevel: job.experienceLevel,
      industry: job.industry,
      companySize: job.companySize,
      postedDate: job.postedDate,
      applyUrl: job.applyUrl,
      selected: job.selected,
      linkedinJobId: job.linkedinJobId,
      linkedinCanonicalUrl: job.linkedinCanonicalUrl,
      aiScore: job.aiScore,
      // Keep full AI description (CSS line-clamp handles visual truncation in list view)
      aiDescription: job.aiDescription,
      aiRequirementChecks: job.aiRequirementChecks,
      aiScoredAt: job.aiScoredAt,
      manualCapture: job.manualCapture,
      manualCapturedAt: job.manualCapturedAt,
      // EXCLUDED for bandwidth optimization:
      // - rawData (removed from DB entirely)
      // - description (up to 10 KB per job - use getJobById for full details)
      // Note: aiDescription is INCLUDED (needed for UI, ~0.5-1 KB per job)
      // Use getJobById query for full details when needed
    }));
  },
});

export const findByLinkedInJobId = query({
  args: {
    linkedinJobId: v.string(),
    canonicalUrl: v.optional(v.string()),
    originalUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
const normalizeForLookup = (value: string | undefined | null) => {
      if (!value) return undefined;
      const normalized = normalizeJobUrl(value);
      return normalized || undefined;
    };

    const canonicalUrl = normalizeForLookup(args.canonicalUrl);
    const originalUrl = normalizeForLookup(args.originalUrl);

    const jobFromId = await ctx.db
      .query("jobs")
      .withIndex("by_user_linkedin_job_id", (q) =>
        q.eq("userId", userId).eq("linkedinJobId", args.linkedinJobId),
      )
      .take(1);

    const jobCandidate =
      jobFromId[0] ??
      (canonicalUrl
        ? (
            await ctx.db
              .query("jobs")
              .withIndex("by_user_linkedin_url", (q) =>
                q.eq("userId", userId).eq("linkedinCanonicalUrl", canonicalUrl),
              )
              .take(1)
          )[0]
        : undefined);

    const jobsToInspect: typeof jobCandidate[] = [];
    if (jobCandidate) {
      jobsToInspect.push(jobCandidate);
    }

    const urlSet = new Set<string>();
    if (args.originalUrl) urlSet.add(args.originalUrl);
    if (canonicalUrl) urlSet.add(canonicalUrl);
    if (originalUrl) urlSet.add(originalUrl);

    for (const url of urlSet) {
      const hits = await ctx.db
        .query("jobs")
        .withIndex("by_url", (q) => q.eq("url", url))
        .take(5);

      for (const job of hits) {
        jobsToInspect.push(job);
      }
    }

    for (const job of jobsToInspect) {
      if (!job) continue;

      if (job.userId === userId) {
        return {
          _id: job._id,
          title: job.title,
          company: job.company,
          url: job.url,
          linkedinJobId: job.linkedinJobId,
          linkedinCanonicalUrl: job.linkedinCanonicalUrl,
          aiScore: job.aiScore,
          aiDescription: job.aiDescription,
          aiRequirementChecks: job.aiRequirementChecks,
          applyUrl: job.applyUrl,
          selected: job.selected ?? false,
        };
      }

      const owningScrape = await ctx.db.get(job.scrapeId);
      if (owningScrape?.userId === userId) {
        return {
          _id: job._id,
          title: job.title,
          company: job.company,
          url: job.url,
          linkedinJobId: job.linkedinJobId,
          linkedinCanonicalUrl: job.linkedinCanonicalUrl,
          aiScore: job.aiScore,
          aiDescription: job.aiDescription,
          aiRequirementChecks: job.aiRequirementChecks,
          applyUrl: job.applyUrl,
          selected: job.selected ?? false,
        };
      }
    }

    return null;
  },
});

// Query to get a specific job by ID
export const getJobById = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
const job = await ctx.db.get(args.jobId);
    if (!job) {
      // Return null instead of throwing to handle deleted jobs gracefully
      return null;
    }

    // Verify user owns the scrape this job belongs to
    const scrape = await ctx.db.get(job.scrapeId);
    if (!scrape || scrape.userId !== userId) {
      throw new Error("Access denied");
    }

    return job;
  },
});

// Migration function to fix missing descriptions from rawData
export const fixMissingDescriptions = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all jobs with missing descriptions but with rawData
    const jobsWithMissingDescriptions = await ctx.db
      .query("jobs")
      .filter((q) => q.and(
        q.or(
          q.eq(q.field("description"), undefined),
          q.eq(q.field("description"), null),
          q.eq(q.field("description"), "")
        ),
        q.neq(q.field("rawData"), undefined)
      ))
      .collect();

    scrapingLog(`Found ${jobsWithMissingDescriptions.length} jobs with missing descriptions`);

    let fixedCount = 0;

    for (const job of jobsWithMissingDescriptions) {
      if (!job.rawData) continue;

      // Extract description using the same logic as saveJob
      const extractField = (fieldNames: string[], defaultValue: any = undefined) => {
        for (const fieldName of fieldNames) {
          if (job.rawData[fieldName] !== undefined && job.rawData[fieldName] !== null && job.rawData[fieldName] !== "") {
            return job.rawData[fieldName];
          }
        }
        return defaultValue;
      };

      const cleanText = (text: string | undefined | null): string | undefined => {
        if (!text || typeof text !== 'string') return undefined;

        let cleaned = text
          .replace(/<[^>]*>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, ' ')
          .trim();

        if (cleaned.length === 0) return undefined;
        return cleaned.substring(0, 10000);
      };

      const description = cleanText(extractField([
        'descriptionText', 'description', 'descriptionHtml', 'jobDescription', 'details', 'summary', 'content'
      ]));

      if (description) {
        await ctx.db.patch(job._id, { description });
        fixedCount++;
      }
    }

    scrapingLog(`Fixed descriptions for ${fixedCount} jobs`);
    return { jobsFound: jobsWithMissingDescriptions.length, jobsFixed: fixedCount };
  },
});

// Internal query to get user profile by userId (for use in actions)
export const getUserProfileByUserId = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

// Action to score a job using AI
export const scoreJobWithAI = action({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args): Promise<{ score: number; description: string }> => {
    const userId = await requireUserId(ctx);
// Get the job and verify ownership
    const job = await ctx.runQuery(internal.jobScraping.getJobByIdInternal, {
      jobId: args.jobId,
    });

    if (!job) {
      throw new Error("Job not found");
    }

    // Verify user owns this job through the scrape
    const scrape = await ctx.runQuery(internal.jobScraping.getScrapeById, {
      scrapeId: job.scrapeId,
    });

    if (!scrape || scrape.userId !== userId) {
      throw new Error("Access denied");
    }

    // Get user profile for personalized analysis
    const userProfile = await ctx.runQuery(internal.jobScraping.getUserProfileByUserId, {
      userId,
    });

    // Get user's interview summary for enhanced context
    const interviewSummary = await ctx.runQuery(internal.jobPreferenceInterviews.getLatestCompletedInterviewSummary, {
      userId,
    });

    // Get user's custom scoring prompt settings
    const scoringPromptSettings = await ctx.runQuery(internal.aiScoringPrompts.getAiScoringPromptInternal, {
      userId,
    });

    // Use custom prompt if enabled and available, otherwise use default
    const scoringCriteria = (scoringPromptSettings?.useCustomPrompt && scoringPromptSettings?.customPrompt)
      ? scoringPromptSettings.customPrompt
      : DEFAULT_SCORING_CRITERIA;

    const jobText = buildJobTextFromJobDocument(job);
    const systemPrompt = buildSystemPrompt({
      userProfile,
      interviewSummary,
      scoringCriteria,
    });

    try {
      // Check and increment AI usage before making the AI call
      await ctx.runMutation(internal.aiUsageTracking.checkAndIncrementAiUsage, {
        userId: userId,
        incrementBy: 1,
      });

      // Generate AI scoring using the AI Gateway
      // The AI Gateway automatically uses AI_GATEWAY_API_KEY environment variable
      const { object: scoring } = await generateObject({
        model: SCORING_MODEL,
        schema: jobScoringSchema,
        system: systemPrompt,
        prompt: `Please evaluate this job opportunity based on the candidate's profile and provide a score with explanation. Address the candidate directly in your explanation using 'you' and 'your':\n\n${jobText}`,
      });


      // Update the job with AI scoring
      await ctx.runMutation(internal.jobScraping.updateJobAIScore, {
        jobId: args.jobId,
        aiScore: scoring.score,
        aiDescription: scoring.description,
        aiRequirementChecks: scoring.requirementChecks,
        aiScoredAt: Date.now(),
      });

      return {
        score: scoring.score,
        description: scoring.description,
      };
    } catch (error) {
      console.error("AI scoring error:", error);
      throw new Error(`Failed to score job with AI: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  },
});

// Internal mutation to update job with AI score
export const updateJobAIScore = internalMutation({
  args: {
    jobId: v.id("jobs"),
    aiScore: v.number(),
    aiDescription: v.string(),
    aiRequirementChecks: v.optional(v.array(v.object({
      requirement: v.string(),
      score: v.number(),
    }))),
    aiScoredAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      aiScore: args.aiScore,
      aiDescription: args.aiDescription,
      aiRequirementChecks: args.aiRequirementChecks,
      aiScoredAt: args.aiScoredAt,
    });
  },
});

// Internal query to get job by ID (for AI scoring)
export const getJobByIdInternal = internalQuery({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

// Utility function to create a consistent job fingerprint for deduplication
function createJobFingerprint(job: {
  title: string;
  company: string;
  description?: string;
  location?: string;
}): string {
  // Normalize text by lowercasing and removing extra whitespace
  const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

  const title = normalize(job.title);
  const company = normalize(job.company);

  // Primary fingerprint: title + company + description (first 500 chars)
  if (job.description && job.description.length > 10) {
    const description = normalize(job.description.substring(0, 500));
    return `${title}|${company}|${description}`;
  }

  // Fallback fingerprint: title + company + location
  const location = job.location ? normalize(job.location) : '';
  return `${title}|${company}|${location}`;
}

// Internal query to find a scored duplicate job by fingerprint
export const findScoredDuplicateJob = internalQuery({
  args: {
    userId: v.id("users"),
    fingerprint: v.string(),
    excludeJobId: v.optional(v.id("jobs")), // Exclude current job from search
  },
  handler: async (ctx, args) => {
    // Get all user's scrapes
    const userScrapes = await ctx.db
      .query("jobScrapes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const userScrapeIds = userScrapes.map(scrape => scrape._id);

    // Get all jobs from user's scrapes that have AI scores
    const allUserJobs = await ctx.db.query("jobs").collect();
    const scoredUserJobs = allUserJobs.filter(job =>
      userScrapeIds.includes(job.scrapeId) &&
      job.aiScore !== undefined &&
      (args.excludeJobId ? job._id !== args.excludeJobId : true)
    );

    // Check each scored job for matching fingerprint
    for (const job of scoredUserJobs) {
      const jobFingerprint = createJobFingerprint({
        title: job.title,
        company: job.company,
        description: job.description,
        location: job.location,
      });

      if (jobFingerprint === args.fingerprint) {
        return job; // Return first matching scored job
      }
    }

    return null; // No duplicate found
  },
});

// Internal query to find a scored job by URL (more reliable than fingerprint)
export const findJobByUrl = internalQuery({
  args: {
    userId: v.id("users"),
    url: v.string(),
    excludeJobId: v.optional(v.id("jobs")),
  },
  handler: async (ctx, args) => {
    const normalizedUrl = normalizeJobUrl(args.url);
    if (!normalizedUrl) return null;

    // Get all user's scrapes first for filtering
    const userScrapes = await ctx.db
      .query("jobScrapes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const userScrapeIds = new Set(userScrapes.map(s => s._id));

    // Try exact URL match first using index (fastest)
    const jobsWithUrl = await ctx.db
      .query("jobs")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .collect();

    const exactMatch = jobsWithUrl.find(job =>
      userScrapeIds.has(job.scrapeId) &&
      (args.excludeJobId ? job._id !== args.excludeJobId : true)
    );

    if (exactMatch) return exactMatch;

    // Fallback: search normalized URLs across user's jobs
    for (const scrapeId of userScrapeIds) {
      const scrapeJobs = await ctx.db
        .query("jobs")
        .withIndex("by_scrape", (q) => q.eq("scrapeId", scrapeId))
        .collect();

      const match = scrapeJobs.find(job =>
        normalizeJobUrl(job.url) === normalizedUrl &&
        (args.excludeJobId ? job._id !== args.excludeJobId : true)
      );

      if (match) return match;
    }

    return null;
  },
});

// Internal query to get unscored jobs for a specific scrape only
export const getUnscoredJobsForScrape = internalQuery({
  args: {
    scrapeId: v.id("jobScrapes"),
  },
  handler: async (ctx, args) => {
    // Get only jobs from this specific scrape that don't have AI scores
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_scrape", (q) => q.eq("scrapeId", args.scrapeId))
      .collect();

    const unscoredJobs = jobs.filter(job => job.aiScore === undefined);

    return unscoredJobs;
  },
});

// Internal mutation to copy AI score from duplicate job
export const copyAIScoreFromDuplicate = internalMutation({
  args: {
    jobId: v.id("jobs"),
    aiScore: v.number(),
    aiDescription: v.string(),
    aiRequirementChecks: v.optional(v.array(v.object({
      requirement: v.string(),
      score: v.number(),
    }))),
    duplicateJobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      aiScore: args.aiScore,
      aiDescription: `${args.aiDescription} (Score copied from similar job)`,
      aiRequirementChecks: args.aiRequirementChecks,
      aiScoredAt: Date.now(),
    });
  },
});

// Internal mutation to update scrape AI scoring progress
export const updateScrapeAIScoringProgress = internalMutation({
  args: {
    scrapeId: v.id("jobScrapes"),
    status: v.optional(v.union(v.literal("scoring"), v.literal("completed"), v.literal("scoring_paused"))),
    totalJobsToScore: v.optional(v.number()),
    jobsScored: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { scrapeId, ...updates } = args;
    await ctx.db.patch(scrapeId, updates);
  },
});

// Internal action to score unscored jobs for a specific scrape (triggered by scrape completion)
export const scoreUnscoredJobsForScrape = internalAction({
  args: {
    scrapeId: v.id("jobScrapes"),
    userId: v.id("users"),
    userEmail: v.optional(v.string()), // User email for sending notification after scoring
    totalJobsScraped: v.optional(v.number()), // Number of jobs scraped (for email content)
  },
  handler: async (ctx, args) => {
    try {

      // Get unscored jobs for THIS SCRAPE ONLY
      const unscoredJobs = await ctx.runQuery(internal.jobScraping.getUnscoredJobsForScrape, {
        scrapeId: args.scrapeId,
      });

      scrapingLog(`Found ${unscoredJobs.length} unscored jobs for scrape ${args.scrapeId}`);

      if (unscoredJobs.length === 0) {
        await ctx.runMutation(internal.jobScraping.updateScrapeAIScoringProgress, {
          scrapeId: args.scrapeId,
          status: "completed",
        });
        return;
      }

      // Update scrape status to scoring and set progress
      await ctx.runMutation(internal.jobScraping.updateScrapeAIScoringProgress, {
        scrapeId: args.scrapeId,
        status: "scoring",
        totalJobsToScore: unscoredJobs.length,
        jobsScored: 0,
      });

      // Score jobs in batches of 5 to avoid timeouts
      const BATCH_SIZE = 5;
      let completedJobs = 0;

      for (let i = 0; i < unscoredJobs.length; i += BATCH_SIZE) {
        const batch = unscoredJobs.slice(i, i + BATCH_SIZE);

        // Score each job in the batch
        for (const job of batch) {
          try {
            // Check URL-based duplicates first (most reliable)
            const urlDuplicate = job.url
              ? await ctx.runQuery(internal.jobScraping.findJobByUrl, {
                  userId: args.userId,
                  url: job.url,
                  excludeJobId: job._id,
                })
              : null;

            if (urlDuplicate && urlDuplicate.aiScore !== undefined) {
              // Copy score from URL duplicate
              await ctx.runMutation(internal.jobScraping.copyAIScoreFromDuplicate, {
                jobId: job._id,
                aiScore: urlDuplicate.aiScore,
                aiDescription: urlDuplicate.aiDescription!,
                aiRequirementChecks: urlDuplicate.aiRequirementChecks,
                duplicateJobId: urlDuplicate._id,
              });
              scrapingLog(`Copied score ${urlDuplicate.aiScore} from URL duplicate: ${job.title} at ${job.company}`);
            } else {
              // Check fingerprint-based duplicates as fallback
              const fingerprint = createJobFingerprint({
                title: job.title,
                company: job.company,
                description: job.description,
                location: job.location,
              });

              const duplicate = await ctx.runQuery(internal.jobScraping.findScoredDuplicateJob, {
                userId: args.userId,
                fingerprint: fingerprint,
                excludeJobId: job._id,
              });

              if (duplicate && duplicate.aiScore !== undefined) {
                // Copy score from fingerprint duplicate
                await ctx.runMutation(internal.jobScraping.copyAIScoreFromDuplicate, {
                  jobId: job._id,
                  aiScore: duplicate.aiScore,
                  aiDescription: duplicate.aiDescription!,
                  aiRequirementChecks: duplicate.aiRequirementChecks,
                  duplicateJobId: duplicate._id,
                });
                scrapingLog(`Copied score ${duplicate.aiScore} from fingerprint duplicate: ${job.title} at ${job.company}`);
              } else {
                // Score this job with AI
                await ctx.runAction(internal.jobScraping.scoreJobWithAIInternal, {
                  jobId: job._id,
                  userId: args.userId,
                });
                scrapingLog(`Scored job with AI: ${job.title} at ${job.company}`);
              }
            }

            completedJobs++;

            // Update progress after each job
            await ctx.runMutation(internal.jobScraping.updateScrapeAIScoringProgress, {
              scrapeId: args.scrapeId,
              jobsScored: completedJobs,
            });

          } catch (error) {
            // Check if this is an AI usage limit error
            if (error instanceof Error && (
              error.message.includes("Daily AI usage limit exceeded") ||
              error.message.includes("Monthly AI usage limit exceeded")
            )) {

              // Update scrape status to indicate scoring was paused due to limits
              await ctx.runMutation(internal.jobScraping.updateScrapeAIScoringProgress, {
                scrapeId: args.scrapeId,
                status: "scoring_paused",
                jobsScored: completedJobs,
              });

              scrapingLog(`AI scoring paused for scrape ${args.scrapeId}. ${completedJobs} of ${unscoredJobs.length} jobs scored. Reason: ${error.message}`);

              // Exit the function early - user can manually retry later or limits will reset
              return;
            }

            console.error(`Failed to score job ${job._id} (${job.title} at ${job.company}):`, error);
            // Continue with other jobs for non-limit errors
          }
        }

        // Small delay between batches to prevent overwhelming the AI service
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Sync actual progress before marking as completed
      const actualScoredJobs = await ctx.runQuery(internal.jobScraping.getActualScoredJobsCount, {
        scrapeId: args.scrapeId,
      });

      // Mark scraping as completed with correct progress
      await ctx.runMutation(internal.jobScraping.updateScrapeAIScoringProgress, {
        scrapeId: args.scrapeId,
        status: "completed",
        jobsScored: actualScoredJobs,
      });


      // Send email notification after scoring is complete (for scheduled scrapes)
      if (args.userEmail) {
        try {
          const todaysHighScoringJobs = await ctx.runQuery(internal.jobScraping.getTodaysHighScoringJobsForUser, {
            userId: args.userId,
            scrapeId: args.scrapeId, // Only get jobs from this specific scrape
          });

          const scrape = await ctx.runQuery(internal.jobScraping.getScrapeById, {
            scrapeId: args.scrapeId,
          });

          if (todaysHighScoringJobs.length > 0) {
            // Send high-scoring jobs email
            await ctx.runAction(api.email.sendHighScoringJobsEmail, {
              jobs: todaysHighScoringJobs.map(job => ({
                jobId: job._id,
                title: job.title,
                company: job.company,
                url: job.url,
                aiScore: job.aiScore,
                applyUrl: job.applyUrl,
              })),
              totalJobsScraped: args.totalJobsScraped || 0,
              userEmail: args.userEmail,
              scrapeName: scrape?.name,
            });
            scrapingLog(`High-scoring jobs email sent to ${args.userEmail} for ${todaysHighScoringJobs.length} jobs after scoring completed`);
          } else {
            // Send encouraging "no high-scoring jobs today" email
            await ctx.runAction(api.email.sendNoHighScoringJobsEmail, {
              totalJobsScraped: args.totalJobsScraped || 0,
              scrapeName: scrape?.name || "Unknown Scrape",
              dashboardUrl: `${DASHBOARD_ROOT}/jobs?scrape=${encodeURIComponent(args.scrapeId)}`,
              userEmail: args.userEmail,
            });
            scrapingLog(`No high-scoring jobs email sent to ${args.userEmail} for scrape: ${scrape?.name} after scoring completed`);
          }
        } catch (emailError) {
          console.error("Failed to send email after scoring:", emailError);
          // Don't fail the scoring if email fails
        }
      }

    } catch (error) {
      console.error(`Error in AI scoring for scrape ${args.scrapeId}:`, error);

      // Mark scrape as completed even if scoring fails (don't block the scrape)
      await ctx.runMutation(internal.jobScraping.updateScrapeAIScoringProgress, {
        scrapeId: args.scrapeId,
        status: "completed",
      });
    }
  },
});

// Internal action wrapper for scoring individual jobs (used in batch processing)
export const scoreJobWithAIInternal = internalAction({
  args: {
    jobId: v.id("jobs"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get the job and verify it exists
    const job = await ctx.runQuery(internal.jobScraping.getJobByIdInternal, {
      jobId: args.jobId,
    });

    if (!job) {
      throw new Error("Job not found");
    }

    // Get user profile for personalized analysis
    const userProfile = await ctx.runQuery(internal.jobScraping.getUserProfileByUserId, {
      userId: args.userId,
    });

    // Get user's interview summary for enhanced context
    const interviewSummary = await ctx.runQuery(internal.jobPreferenceInterviews.getLatestCompletedInterviewSummary, {
      userId: args.userId,
    });

    // Get user's custom scoring prompt settings
    const scoringPromptSettings = await ctx.runQuery(internal.aiScoringPrompts.getAiScoringPromptInternal, {
      userId: args.userId,
    });

    // Use custom prompt if enabled and available, otherwise use default
    const scoringCriteria = (scoringPromptSettings?.useCustomPrompt && scoringPromptSettings?.customPrompt)
      ? scoringPromptSettings.customPrompt
      : DEFAULT_SCORING_CRITERIA;

    const jobText = buildJobTextFromJobDocument(job);
    const systemPrompt = buildSystemPrompt({
      userProfile,
      interviewSummary,
      scoringCriteria,
    });

    // Check and increment AI usage before making the AI call
    await ctx.runMutation(internal.aiUsageTracking.checkAndIncrementAiUsage, {
      userId: args.userId,
      incrementBy: 1,
    });

    // Generate AI scoring using the AI Gateway
    const { object: scoring } = await generateObject({
      model: SCORING_MODEL,
      schema: jobScoringSchema,
      system: systemPrompt,
      prompt: `Please evaluate this job opportunity based on the candidate's profile and provide a score with explanation. Address the candidate directly in your explanation using 'you' and 'your':\n\n${jobText}`,
    });

    // Update the job with AI scoring
    await ctx.runMutation(internal.jobScraping.updateJobAIScore, {
      jobId: args.jobId,
      aiScore: scoring.score,
      aiDescription: scoring.description,
      aiRequirementChecks: scoring.requirementChecks,
      aiScoredAt: Date.now(),
    });

    return {
      score: scoring.score,
      description: scoring.description,
    };
  },
});

// Mutation to resume AI scoring for a paused scrape
export const resumeScoring = mutation({
  args: {
    scrapeId: v.id("jobScrapes"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
// Get the scrape and verify ownership
    const scrape = await ctx.db.get(args.scrapeId);
    if (!scrape || scrape.userId !== userId) {
      throw new Error("Access denied");
    }

    // Check if the scrape is actually paused
    if (scrape.status !== "scoring_paused") {
      throw new Error("Scrape is not in a paused state");
    }

    // Sync progress before checking if resume is needed (fixes existing discrepancies)
    const actualScoredJobs = await ctx.runQuery(internal.jobScraping.getActualScoredJobsCount, {
      scrapeId: args.scrapeId,
    });

    // Update progress to reflect reality
    await ctx.runMutation(internal.jobScraping.updateScrapeAIScoringProgress, {
      scrapeId: args.scrapeId,
      jobsScored: actualScoredJobs,
    });

    // If all jobs are actually scored, mark as completed instead of resuming
    if (actualScoredJobs === scrape.totalJobsToScore) {
      await ctx.runMutation(internal.jobScraping.updateScrapeAIScoringProgress, {
        scrapeId: args.scrapeId,
        status: "completed",
        jobsScored: actualScoredJobs,
      });
      return { success: true, message: "All jobs already scored, marked as completed" };
    }

    // Check current AI usage to see if we can resume
    const aiUsage = await ctx.runQuery(internal.aiUsageTracking.getAiUsageForUser, {
      userId: userId,
    });

    if (aiUsage.daily.remainingScores <= 0) {
      throw new Error("Daily AI usage limit still exceeded. Please try again tomorrow.");
    }

    if (aiUsage.monthly.remainingScores <= 0) {
      throw new Error("Monthly AI usage limit still exceeded. Please upgrade your plan or wait for next month.");
    }

    // Resume scoring by triggering the scoring action
    await ctx.scheduler.runAfter(0, internal.jobScraping.scoreUnscoredJobsForScrape, {
      scrapeId: args.scrapeId,
      userId: userId,
      userEmail: undefined, // No email notification for resumed scoring
      totalJobsScraped: scrape.totalJobs,
    });

    // Update status to indicate scoring has resumed
    await ctx.runMutation(internal.jobScraping.updateScrapeAIScoringProgress, {
      scrapeId: args.scrapeId,
      status: "scoring",
    });

    return { success: true };
  },
});

// Internal query to get actual count of scored jobs for a scrape
export const getActualScoredJobsCount = internalQuery({
  args: {
    scrapeId: v.id("jobScrapes")
  },
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_scrape", (q) => q.eq("scrapeId", args.scrapeId))
      .collect();

    return jobs.filter(job => job.aiScore !== undefined).length;
  },
});

export const getUserNotificationEmail = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userDoc = await ctx.db.get(args.userId);
    if (userDoc && typeof (userDoc as any).email === "string" && (userDoc as any).email.length > 0) {
      return (userDoc as any).email as string;
    }

    const profile = await ctx.db
      .query("linkedinProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (profile?.email && profile.email.length > 0) {
      return profile.email;
    }

    return undefined;
  },
});
