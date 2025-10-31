import { v } from "convex/values";
import { query, mutation, action, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { requireUserId } from "./lib/auth";

const APP_BASE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://applyfa.st").replace(/\/$/, "");
const DASHBOARD_ROOT = `${APP_BASE_URL}/dashboard`;

// Query to list all recurring job scrapes for the current user
export const listRecurringJobScrapes = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
return await ctx.db
      .query("recurringJobScrapes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

// Mutation to create a new recurring job scrape
export const createRecurringJobScrape = mutation({
  args: {
    name: v.string(),
    linkedinUrl: v.string(),
    location: v.string(),
    frequency: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
    dayOfWeek: v.optional(v.number()), // 0-6 for weekly (0 = Sunday)
    dayOfMonth: v.optional(v.number()), // 1-31 for monthly
    hour: v.number(), // 0-23
    minute: v.number(), // 0-59
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
    const userId = await requireUserId(ctx);
// Get user's email from the users table (Password auth stores it there)
    const user = await ctx.db.get(userId);
    const userEmail = user?.email;

    console.log("Creating recurring scrape - user:", user);
    console.log("User email extracted:", userEmail);

    if (!userEmail) {
      console.warn("⚠️  No email found in user record when creating recurring scrape");
    }

    const trimmedLocation = args.location.trim();
    if (!trimmedLocation) {
      throw new Error("Location is required for recurring job scrapes");
    }

    // Validate schedule parameters
    if (args.frequency === "weekly" && (args.dayOfWeek === undefined || args.dayOfWeek < 0 || args.dayOfWeek > 6)) {
      throw new Error("Invalid day of week for weekly schedule");
    }
    if (args.frequency === "monthly" && (args.dayOfMonth === undefined || args.dayOfMonth < 1 || args.dayOfMonth > 31)) {
      throw new Error("Invalid day of month for monthly schedule");
    }
    if (args.hour < 0 || args.hour > 23) {
      throw new Error("Invalid hour");
    }
    if (args.minute < 0 || args.minute > 59) {
      throw new Error("Invalid minute");
    }

    const id = await ctx.db.insert("recurringJobScrapes", {
      name: args.name,
      location: trimmedLocation,
      linkedinUrl: args.linkedinUrl,
      frequency: args.frequency,
      dayOfWeek: args.dayOfWeek,
      dayOfMonth: args.dayOfMonth,
      hour: args.hour,
      minute: args.minute,
      emailSettings: args.emailSettings,
      userId,
      userEmail: userEmail, // Store user's email for background notifications (optional)
      enabled: true,
      lastRun: undefined,
      nextRun: undefined,
      scheduledFunctionId: undefined,
      createdAt: Date.now(),
    });

    // Schedule the first execution
    await ctx.scheduler.runAfter(0, internal.recurringJobScrapes.scheduleNextExecution, {
      recurringJobScrapeId: id
    });

    return id;
  },
});

// Mutation to update a recurring job scrape
export const updateRecurringJobScrape = mutation({
  args: {
    id: v.id("recurringJobScrapes"),
    name: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    location: v.optional(v.string()),
    frequency: v.optional(v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"))),
    dayOfWeek: v.optional(v.number()),
    dayOfMonth: v.optional(v.number()),
    hour: v.optional(v.number()),
    minute: v.optional(v.number()),
    enabled: v.optional(v.boolean()),
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
    const userId = await requireUserId(ctx);
const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Recurring job scrape not found or access denied");
    }

    const { id, location: newLocation, ...rest } = args;
    const updateData: Record<string, any> = { ...rest };

    if (newLocation !== undefined) {
      const trimmedLocation = newLocation.trim();
      if (!trimmedLocation) {
        throw new Error("Location cannot be empty");
      }
      updateData.location = trimmedLocation;
    }

    // Validate schedule parameters if they're being updated
    const frequency = args.frequency || existing.frequency;
    const dayOfWeek = args.dayOfWeek !== undefined ? args.dayOfWeek : existing.dayOfWeek;
    const dayOfMonth = args.dayOfMonth !== undefined ? args.dayOfMonth : existing.dayOfMonth;
    const hour = args.hour !== undefined ? args.hour : existing.hour;
    const minute = args.minute !== undefined ? args.minute : existing.minute;

    if (frequency === "weekly" && (dayOfWeek === undefined || dayOfWeek < 0 || dayOfWeek > 6)) {
      throw new Error("Invalid day of week for weekly schedule");
    }
    if (frequency === "monthly" && (dayOfMonth === undefined || dayOfMonth < 1 || dayOfMonth > 31)) {
      throw new Error("Invalid day of month for monthly schedule");
    }
    if (hour < 0 || hour > 23) {
      throw new Error("Invalid hour");
    }
    if (minute < 0 || minute > 59) {
      throw new Error("Invalid minute");
    }

    await ctx.db.patch(id, updateData);

    // If schedule changed or enabled status changed, reschedule
    const scheduleChanged = args.frequency || args.dayOfWeek !== undefined ||
                           args.dayOfMonth !== undefined || args.hour !== undefined || args.minute !== undefined;

    if (scheduleChanged || args.enabled !== undefined) {
      // Cancel existing scheduled function if it exists
      if (existing.scheduledFunctionId) {
        await ctx.scheduler.cancel(existing.scheduledFunctionId);
        await ctx.db.patch(id, { scheduledFunctionId: undefined });
      }

      // Schedule new execution if still enabled
      if (args.enabled !== false) {
        await ctx.scheduler.runAfter(0, internal.recurringJobScrapes.scheduleNextExecution, {
          recurringJobScrapeId: args.id
        });
      }
    }
  },
});

// Mutation to delete a recurring job scrape
export const deleteRecurringJobScrape = mutation({
  args: {
    id: v.id("recurringJobScrapes"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Recurring job scrape not found or access denied");
    }

    // Cancel any scheduled function
    if (existing.scheduledFunctionId) {
      await ctx.scheduler.cancel(existing.scheduledFunctionId);
    }

    await ctx.db.delete(args.id);
  },
});

// Mutation to toggle a recurring job scrape on/off
export const toggleRecurringJobScrape = mutation({
  args: {
    id: v.id("recurringJobScrapes"),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Recurring job scrape not found or access denied");
    }

    await ctx.db.patch(args.id, { enabled: args.enabled });

    // Cancel existing scheduled function
    if (existing.scheduledFunctionId) {
      await ctx.scheduler.cancel(existing.scheduledFunctionId);
      await ctx.db.patch(args.id, { scheduledFunctionId: undefined });
    }

    // Schedule new execution if enabled
    if (args.enabled) {
      await ctx.scheduler.runAfter(0, internal.recurringJobScrapes.scheduleNextExecution, {
        recurringJobScrapeId: args.id
      });
    }
  },
});

// Mutation to toggle email notifications for a recurring job scrape
export const toggleEmailNotifications = mutation({
  args: {
    id: v.id("recurringJobScrapes"),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Recurring job scrape not found or access denied");
    }

    // Get current email settings or create default ones
    const currentEmailSettings = existing.emailSettings || {
      enabled: true,
      timing: "auto" as const,
      delayMinutes: 5,
      manualTime: undefined,
    };

    // Update only the enabled field
    await ctx.db.patch(args.id, {
      emailSettings: {
        ...currentEmailSettings,
        enabled: args.enabled,
      },
    });
  },
});

// Internal mutation to schedule the next execution
export const scheduleNextExecution = internalMutation({
  args: {
    recurringJobScrapeId: v.id("recurringJobScrapes"),
  },
  handler: async (ctx, args) => {
    const recurringJobScrape = await ctx.db.get(args.recurringJobScrapeId);
    if (!recurringJobScrape || !recurringJobScrape.enabled) {
      return;
    }

    const nextRun = calculateNextRun(
      recurringJobScrape.frequency,
      recurringJobScrape.hour,
      recurringJobScrape.minute,
      recurringJobScrape.dayOfWeek,
      recurringJobScrape.dayOfMonth
    );

    const delay = nextRun - Date.now();
    if (delay > 0) {
      const scheduledFunctionId = await ctx.scheduler.runAfter(delay, internal.recurringJobScrapes.executeJobScrape, {
        recurringJobScrapeId: args.recurringJobScrapeId,
      });

      await ctx.db.patch(args.recurringJobScrapeId, {
        nextRun,
        scheduledFunctionId,
      });
    }
  },
});

// Internal action to execute the job scrape
export const executeJobScrape = internalAction({
  args: {
    recurringJobScrapeId: v.id("recurringJobScrapes"),
  },
  handler: async (ctx, args) => {
    console.log("🔄 executeJobScrape started for:", args.recurringJobScrapeId);

    const recurringJobScrape = await ctx.runQuery(internal.recurringJobScrapes.getRecurringJobScrape, {
      id: args.recurringJobScrapeId,
    });

    if (!recurringJobScrape || !recurringJobScrape.enabled) {
      console.log("⚠️  Recurring scrape not found or disabled:", args.recurringJobScrapeId);
      return;
    }

    console.log("Recurring scrape details:", {
      name: recurringJobScrape.name,
      userId: recurringJobScrape.userId,
      userEmail: recurringJobScrape.userEmail,
      emailSettings: recurringJobScrape.emailSettings
    });

    const executedAt = Date.now();

    try {
      // Get user email for notifications
      let userEmail = recurringJobScrape.userEmail;

      // If email is missing, fetch it from the users table and update the recurring scrape
      if (!userEmail) {
        console.warn("⚠️  No userEmail found in recurring scrape. Fetching from users table...");
        const user = await ctx.runQuery(internal.recurringJobScrapes.getUserEmail, {
          userId: recurringJobScrape.userId as any,
        });
        userEmail = user?.email as string | undefined;

        if (userEmail) {
          console.log(`✅ Found email: ${userEmail}. Updating recurring scrape for future runs.`);
          // Update the recurring scrape with the email for next time
          await ctx.runMutation(internal.recurringJobScrapes.updateUserEmail, {
            recurringJobScrapeId: args.recurringJobScrapeId,
            userEmail: userEmail,
          });
        } else {
          console.error("❌ Could not find user email in users table. Emails will not be sent.");
        }
      }

      // Create a regular job scrape for this execution
      const scrapeId = await ctx.runMutation(internal.jobScraping.createJobScrapeFromRecurring, {
        name: recurringJobScrape.name,
        linkedinUrl: recurringJobScrape.linkedinUrl,
        userId: recurringJobScrape.userId,
      });

      console.log("Created job scrape:", scrapeId);

      // Get email settings (support both new and legacy format)
      const emailSettings = getEmailSettings(recurringJobScrape);
      console.log("Email settings:", emailSettings);

      const emailForNotification = getEmailForNotification(emailSettings, userEmail);
      console.log("Email for notification:", emailForNotification);

      // Execute the scrape
      await ctx.runAction(internal.apifyActions.executeApifyScrape, {
        scrapeId,
        linkedinUrl: recurringJobScrape.linkedinUrl,
        userEmail: emailForNotification,
        emailSettings: emailSettings,
      });

      console.log("✅ Scrape execution completed successfully");

      // Update last run time
      await ctx.runMutation(internal.recurringJobScrapes.updateLastRun, {
        recurringJobScrapeId: args.recurringJobScrapeId,
        lastRun: executedAt,
      });

    } catch (error) {
      console.error("❌ Error in recurring job scrape execution:", error);
      console.error("Error details:", {
        recurringJobScrapeId: args.recurringJobScrapeId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }

    // Schedule the next execution
    await ctx.runMutation(internal.recurringJobScrapes.scheduleNextExecution, {
      recurringJobScrapeId: args.recurringJobScrapeId,
    });
  },
});

// Internal query to get a recurring job scrape
export const getRecurringJobScrape = internalQuery({
  args: {
    id: v.id("recurringJobScrapes"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Internal query to get user email from users table
export const getUserEmail = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user;
  },
});

// Internal mutation to update last run time
export const updateLastRun = internalMutation({
  args: {
    recurringJobScrapeId: v.id("recurringJobScrapes"),
    lastRun: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.recurringJobScrapeId, {
      lastRun: args.lastRun,
      scheduledFunctionId: undefined, // Clear since this execution is complete
    });
  },
});

// Internal mutation to update user email in recurring job scrape
export const updateUserEmail = internalMutation({
  args: {
    recurringJobScrapeId: v.id("recurringJobScrapes"),
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.recurringJobScrapeId, {
      userEmail: args.userEmail,
    });
  },
});

// Query to get scheduled functions status for a recurring job scrape
export const getScheduledFunctionStatus = query({
  args: {
    recurringJobScrapeId: v.id("recurringJobScrapes"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
// Verify user owns this recurring job scrape
    const recurringJobScrape = await ctx.db.get(args.recurringJobScrapeId);
    if (!recurringJobScrape || recurringJobScrape.userId !== userId) {
      throw new Error("Access denied");
    }

    if (!recurringJobScrape.scheduledFunctionId) {
      return null;
    }

    return await ctx.db.system.get(recurringJobScrape.scheduledFunctionId);
  },
});


// Helper function to calculate next run time based on frequency and time
function calculateNextRun(
  frequency: "daily" | "weekly" | "monthly",
  hour: number,
  minute: number,
  dayOfWeek?: number,
  dayOfMonth?: number
): number {
  // Create a date representing the target time in Amsterdam timezone
  // We'll use a more direct approach by creating the date in Amsterdam timezone
  const now = new Date();
  
  // Get current time in Amsterdam timezone
  const amsterdamNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Amsterdam" }));
  const utcNow = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  const timezoneOffset = amsterdamNow.getTime() - utcNow.getTime();
  
  // Create next run time in Amsterdam timezone
  const next = new Date(now.getTime() + timezoneOffset);
  next.setHours(hour, minute, 0, 0);

  switch (frequency) {
    case "daily":
      // If the time has already passed today, move to tomorrow
      if (next <= amsterdamNow) {
        next.setDate(next.getDate() + 1);
      }
      break;

    case "weekly":
      if (dayOfWeek === undefined) throw new Error("dayOfWeek required for weekly frequency");

      // Calculate days until the target day of week
      const currentDayOfWeek = next.getDay();
      let daysUntilTarget = (dayOfWeek - currentDayOfWeek + 7) % 7;

      // If it's the same day but time has passed, move to next week
      if (daysUntilTarget === 0 && next <= amsterdamNow) {
        daysUntilTarget = 7;
      }

      next.setDate(next.getDate() + daysUntilTarget);
      break;

    case "monthly":
      if (dayOfMonth === undefined) throw new Error("dayOfMonth required for monthly frequency");

      // Set to the target day of month
      next.setDate(dayOfMonth);

      // If the date has already passed this month, move to next month
      if (next <= amsterdamNow) {
        next.setMonth(next.getMonth() + 1);
        next.setDate(dayOfMonth);
      }

      // Handle case where dayOfMonth doesn't exist in the target month
      // (e.g., February 31st becomes February 28th/29th)
      if (next.getDate() !== dayOfMonth) {
        next.setDate(0); // Go to last day of previous month
      }
      break;
  }

  // Convert back to UTC by subtracting the timezone offset
  return next.getTime() - timezoneOffset;
}

// Helper function to get email settings (supporting both new and legacy format)
function getEmailSettings(recurringJobScrape: any): any {
  // If new emailSettings exists, use it
  if (recurringJobScrape.emailSettings) {
    return recurringJobScrape.emailSettings;
  }

  // Convert legacy format to new format
  if (recurringJobScrape.digestEnabled !== undefined) {
    return {
      enabled: recurringJobScrape.digestEnabled,
      timing: "auto" as const,
      delayMinutes: 5, // Default 5 minutes for legacy
      manualTime: undefined,
    };
  }

  // Default settings if neither exists
  return {
    enabled: true,
    timing: "auto" as const,
    delayMinutes: 5,
    manualTime: undefined,
  };
}

// Helper function to determine if email should be sent immediately
function getEmailForNotification(
  emailSettings: any,
  userEmail?: string
): string | undefined {
  // If email is disabled, return undefined
  if (!emailSettings?.enabled) {
    return undefined;
  }

  // If timing is auto, return email for immediate sending (after delay)
  if (emailSettings.timing === "auto") {
    return userEmail;
  }

  // If timing is manual, don't send email immediately (will be scheduled)
  return undefined;
}

// Internal action to send delayed email notifications
export const sendDelayedEmail = internalAction({
  args: {
    scrapeId: v.id("jobScrapes"),
    userId: v.id("users"),
    userEmail: v.optional(v.string()),
    totalJobsScraped: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    console.log("sendDelayedEmail called with:", {
      scrapeId: args.scrapeId,
      userId: args.userId,
      userEmail: args.userEmail,
      totalJobsScraped: args.totalJobsScraped
    });

    if (!args.userEmail) {
      console.error("❌ Cannot send email: userEmail is missing", {
        scrapeId: args.scrapeId,
        userId: args.userId
      });
      return;
    }

    try {
      console.log("Fetching high-scoring jobs for user:", args.userId, "scrape:", args.scrapeId);
      const todaysHighScoringJobs = await ctx.runQuery(internal.jobScraping.getTodaysHighScoringJobsForUser, {
        userId: args.userId,
        scrapeId: args.scrapeId, // Only get jobs from this specific scrape
      });

      console.log(`Found ${todaysHighScoringJobs.length} high-scoring jobs for scrape ${args.scrapeId}`);

      const scrape = await ctx.runQuery(internal.jobScraping.getScrapeById, {
        scrapeId: args.scrapeId,
      });

      if (todaysHighScoringJobs.length > 0) {
        console.log(`Sending high-scoring jobs email to ${args.userEmail}...`);
        const result = await ctx.runAction(api.email.sendHighScoringJobsEmail, {
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
        console.log(`✅ High-scoring jobs email sent to ${args.userEmail}:`, result);
      } else {
        console.log(`Sending no high-scoring jobs email to ${args.userEmail}...`);
        const result = await ctx.runAction(api.email.sendNoHighScoringJobsEmail, {
          totalJobsScraped: args.totalJobsScraped || 0,
          scrapeName: scrape?.name || "Unknown Scrape",
          dashboardUrl: `${DASHBOARD_ROOT}/jobs?scrape=${encodeURIComponent(args.scrapeId)}`,
          userEmail: args.userEmail,
        });
        console.log(`✅ No high-scoring jobs email sent to ${args.userEmail}:`, result);
      }
    } catch (emailError) {
      console.error("❌ Failed to send delayed email:", emailError);
      console.error("Email error details:", {
        scrapeId: args.scrapeId,
        userId: args.userId,
        userEmail: args.userEmail,
        error: emailError instanceof Error ? emailError.message : String(emailError),
        stack: emailError instanceof Error ? emailError.stack : undefined
      });
    }
  },
});
