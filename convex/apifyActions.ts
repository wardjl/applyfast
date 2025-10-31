"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { ApifyClient } from "apify-client";

const APIFY_DEBUG = process.env.JOB_SCRAPING_DEBUG === "true";
const apifyLog = (...args: unknown[]) => {
  if (APIFY_DEBUG) {
    apifyLog(...args);
  }
};

// Node.js action to execute Apify scraping
export const executeApifyScrape = internalAction({
  args: {
    scrapeId: v.id("jobScrapes"),
    linkedinUrl: v.string(),
    userEmail: v.optional(v.string()), // User email for notifications (for scheduled scrapes)
    emailSettings: v.optional(v.object({
      enabled: v.boolean(),
      timing: v.union(v.literal("auto"), v.literal("manual")),
      delayMinutes: v.number(),
      manualTime: v.optional(v.object({
        hour: v.number(),
        minute: v.number(),
      })),
    })),
  },
  handler: async (ctx, args) => {
    try {
      const apiKey = process.env.APIFY_API_KEY;
      if (!apiKey) {
        throw new Error("Missing APIFY_API_KEY environment variable");
      }

      // Update status to running
      await ctx.runMutation(internal.jobScraping.updateScrapeStatus, {
        scrapeId: args.scrapeId,
        status: "running",
      });

      // Initialize the ApifyClient with API token
      const client = new ApifyClient({
        token: apiKey,
      });

      // Prepare Actor input using the LinkedIn URL directly
      const input = {
        urls: [args.linkedinUrl],
        scrapeCompany: true,
        count: 100
      };

      apifyLog("Starting Apify scrape with input:", input);

      // Run the Actor and wait for it to finish
      const run = await client.actor("hKByXkMQaC5Qt9UMN").call(input);

      apifyLog("Apify run completed:", run);

      // Update scrape with run ID
      await ctx.runMutation(internal.jobScraping.updateScrapeRunId, {
        scrapeId: args.scrapeId,
        apifyRunId: run.id,
      });

      // Fetch and process Actor results
      const { items } = await client.dataset(run.defaultDatasetId).listItems();

      apifyLog(`Found ${items.length} jobs from Apify`);

      // Get the scrape to access userId
      const scrapeForUserId = await ctx.runQuery(internal.jobScraping.getScrapeById, {
        scrapeId: args.scrapeId,
      });

      if (!scrapeForUserId) {
        throw new Error("Scrape not found");
      }

      // Process all jobs in batch with URL deduplication
      const batchResult = await ctx.runMutation(internal.jobScraping.saveJobsBatch, {
        scrapeId: args.scrapeId,
        jobsData: items,
        userId: scrapeForUserId.userId,
      });

      apifyLog(`Batch save completed: ${batchResult.newJobsCount} new jobs saved, ${batchResult.duplicatesSkipped} duplicates skipped, ${batchResult.totalProcessed} total processed`);

      // Update scrape status to completed (temporarily)
      await ctx.runMutation(internal.jobScraping.updateScrapeStatus, {
        scrapeId: args.scrapeId,
        status: "completed",
        totalJobs: batchResult.newJobsCount, // Only count new jobs, not duplicates
        completedAt: Date.now(),
      });

      // Get scrape details for AI scoring and email notification
      const scrape = await ctx.runQuery(internal.jobScraping.getScrapeById, {
        scrapeId: args.scrapeId,
      });

      if (scrape) {
        // Determine user email for notifications
        let recipientEmail: string | null = null;

        // First priority: Email passed from scheduled scrape
        if (args.userEmail) {
          recipientEmail = args.userEmail;
        }

        if (!recipientEmail) {
          recipientEmail =
            (await ctx.runQuery(internal.jobScraping.getUserNotificationEmail, {
              userId: scrape.userId,
            })) ?? null;
        }

        // Handle email notifications based on settings
        if (args.emailSettings?.enabled) {
          if (!recipientEmail) {
            console.warn("📧 Email notifications enabled but no recipient email could be resolved");
          }
          apifyLog("📧 Email notifications enabled with settings:", args.emailSettings);
          apifyLog("Recipient email:", recipientEmail);

          if (!recipientEmail) {
            apifyLog("Skipping email scheduling because no email address is available");
            await ctx.scheduler.runAfter(0, internal.jobScraping.scoreUnscoredJobsForScrape, {
              scrapeId: args.scrapeId,
              userId: scrape.userId,
              userEmail: undefined,
              totalJobsScraped: batchResult.newJobsCount,
            });
          } else if (args.emailSettings.timing === "auto") {
            // Auto timing: send email after delay following AI scoring
            const delayMilliseconds = args.emailSettings.delayMinutes * 60 * 1000;
            apifyLog(`⏰ Auto timing: will send email ${args.emailSettings.delayMinutes} minutes after scoring`);

            // Trigger AI scoring first (immediate)
            await ctx.scheduler.runAfter(0, internal.jobScraping.scoreUnscoredJobsForScrape, {
              scrapeId: args.scrapeId,
              userId: scrape.userId,
              userEmail: undefined, // Don't send email immediately
              totalJobsScraped: batchResult.newJobsCount,
            });

            // Schedule delayed email after AI scoring + delay
            apifyLog(`📅 Scheduling delayed email for ${delayMilliseconds}ms from now to: ${recipientEmail}`);
            await ctx.scheduler.runAfter(delayMilliseconds, internal.recurringJobScrapes.sendDelayedEmail, {
              scrapeId: args.scrapeId,
              userId: scrape.userId,
              userEmail: recipientEmail || undefined,
              totalJobsScraped: batchResult.newJobsCount,
            });
            apifyLog("✅ Email scheduled successfully");
          } else if (args.emailSettings.timing === "manual" && args.emailSettings.manualTime) {
            // Manual timing: schedule email for specific time
            const emailTime = calculateEmailTime(args.emailSettings.manualTime);
            const delay = emailTime - Date.now();
            apifyLog(`⏰ Manual timing: email scheduled for ${args.emailSettings.manualTime.hour}:${args.emailSettings.manualTime.minute}`);
            apifyLog(`Delay: ${delay}ms (${Math.round(delay / 1000 / 60)} minutes)`);

            // Trigger AI scoring first (immediate)
            await ctx.scheduler.runAfter(0, internal.jobScraping.scoreUnscoredJobsForScrape, {
              scrapeId: args.scrapeId,
              userId: scrape.userId,
              userEmail: undefined, // Don't send email immediately
              totalJobsScraped: batchResult.newJobsCount,
            });

            // Schedule email for manual time (if in the future)
            if (delay > 0) {
              apifyLog(`📅 Scheduling email for manual time to: ${recipientEmail}`);
              await ctx.scheduler.runAfter(delay, internal.recurringJobScrapes.sendDelayedEmail, {
                scrapeId: args.scrapeId,
                userId: scrape.userId,
                userEmail: recipientEmail || undefined,
                totalJobsScraped: batchResult.newJobsCount,
              });
              apifyLog("✅ Email scheduled successfully");
            } else {
              console.warn("⚠️  Manual time is in the past, skipping email scheduling");
            }
          }
        } else {
          apifyLog("📧 Email notifications disabled, only triggering AI scoring");
          // No email notifications - just trigger AI scoring
          await ctx.scheduler.runAfter(0, internal.jobScraping.scoreUnscoredJobsForScrape, {
            scrapeId: args.scrapeId,
            userId: scrape.userId,
            userEmail: undefined,
            totalJobsScraped: batchResult.newJobsCount,
          });
        }
      }

    } catch (error) {
      console.error("Error in Apify job scrape:", error);

      // Update scrape status to failed
      await ctx.runMutation(internal.jobScraping.updateScrapeStatus, {
        scrapeId: args.scrapeId,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        completedAt: Date.now(),
      });
    }
  },
});

// Helper function to calculate the next email time for manual timing
function calculateEmailTime(manualTime: { hour: number; minute: number }): number {
  const now = new Date();
  const today = new Date();
  today.setHours(manualTime.hour, manualTime.minute, 0, 0);

  // If the time has already passed today, schedule for today (since this is the day of the scrape)
  return today.getTime();
}
