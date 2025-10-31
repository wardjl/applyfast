import { query } from "./_generated/server";
import { getOptionalUserId, requireAdminUser } from "./lib/auth";

// Query to examine the actual scraped job data structure
export const inspectJobData = query({
  args: {},
  handler: async (ctx) => {
    if (process.env.ENABLE_DATA_INSPECTOR !== "true") {
      try {
        await requireAdminUser(ctx);
      } catch {
        return { error: "Data inspector disabled" };
      }
    }

    const userId = await getOptionalUserId(ctx);
    if (!userId) {
      return { error: "User not authenticated" };
    }

    // Get the most recent job scrape
    const recentScrape = await ctx.db
      .query("jobScrapes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    if (!recentScrape) {
      return { error: "No job scrapes found" };
    }

    // Get a few sample jobs to examine their structure
    const sampleJobs = await ctx.db
      .query("jobs")
      .withIndex("by_scrape", (q) => q.eq("scrapeId", recentScrape._id))
      .take(3);

    return {
      scrape: recentScrape,
      sampleCount: sampleJobs.length,
      sampleJobs: sampleJobs.map(job => ({
        id: job._id,
        title: job.title,
        company: job.company,
        location: job.location,
        salary: job.salary,
        employmentType: job.employmentType,
        experienceLevel: job.experienceLevel,
        rawDataKeys: job.rawData ? Object.keys(job.rawData) : [],
        rawDataSample: job.rawData ? JSON.stringify(job.rawData, null, 2).substring(0, 1000) : null
      }))
    };
  },
});

// Query to get all available raw data fields across all jobs
export const analyzeJobDataFields = query({
  args: {},
  handler: async (ctx) => {
    if (process.env.ENABLE_DATA_INSPECTOR !== "true") {
      try {
        await requireAdminUser(ctx);
      } catch {
        return { error: "Data inspector disabled" };
      }
    }

    const userId = await getOptionalUserId(ctx);
    if (!userId) {
      return { error: "User not authenticated" };
    }

    // Get all jobs for the user
    const scrapes = await ctx.db
      .query("jobScrapes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (scrapes.length === 0) {
      return { error: "No job scrapes found" };
    }

    const allJobs = [];
    for (const scrape of scrapes) {
      const jobs = await ctx.db
        .query("jobs")
        .withIndex("by_scrape", (q) => q.eq("scrapeId", scrape._id))
        .collect();
      allJobs.push(...jobs);
    }

    // Analyze field usage across all jobs
    const fieldAnalysis: Record<string, any> = {};
    let totalJobs = 0;

    for (const job of allJobs) {
      totalJobs++;
      if (job.rawData && typeof job.rawData === 'object') {
        for (const [key, value] of Object.entries(job.rawData)) {
          if (!fieldAnalysis[key]) {
            fieldAnalysis[key] = {
              count: 0,
              type: typeof value,
              samples: []
            };
          }
          fieldAnalysis[key].count++;
          if (fieldAnalysis[key].samples.length < 3) {
            fieldAnalysis[key].samples.push(value);
          }
        }
      }
    }

    // Sort by usage frequency
    const sortedFields = Object.entries(fieldAnalysis)
      .map(([field, data]) => ({
        field,
        usage: `${data.count}/${totalJobs} (${Math.round((data.count/totalJobs) * 100)}%)`,
        type: data.type,
        samples: data.samples
      }))
      .sort((a, b) => parseInt(b.usage) - parseInt(a.usage));

    return {
      totalJobs,
      totalScrapes: scrapes.length,
      fields: sortedFields
    };
  },
});
