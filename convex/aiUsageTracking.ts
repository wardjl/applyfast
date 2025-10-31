import { v } from "convex/values";
import { query, internalQuery, internalMutation } from "./_generated/server";
import { requireAdminUser, requireUserId } from "./lib/auth";

// Default limits - can be overridden via environment variables or per-user settings
const DEFAULT_DAILY_LIMIT = 100;
const DEFAULT_MONTHLY_LIMIT = 1000;

// Query to get current daily AI usage for authenticated user
export const getDailyAiUsage = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const usage = await ctx.db
      .query("userDailyAiUsage")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", today))
      .first();

    // Calculate when daily limit resets (tomorrow at midnight UTC)
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);

    // Calculate hours until reset
    const now = new Date();
    const hoursUntilReset = Math.ceil((tomorrow.getTime() - now.getTime()) / (1000 * 60 * 60));
    const resetTime = `Resets in ${hoursUntilReset}h`;
    const dailyLimit = usage?.dailyLimit ?? DEFAULT_DAILY_LIMIT;
    const aiCallsUsed = usage?.aiCallsUsed ?? 0;
    const remainingScores = Math.max(dailyLimit - aiCallsUsed, 0);

    return {
      date: today,
      resetTime,
      resetTimestamp: tomorrow.getTime(),
      aiCallsUsed,
      dailyLimit,
      remainingScores,
      isLimitReached: remainingScores <= 0,
    };
  },
});

// Query to get current monthly AI usage for authenticated user
export const getMonthlyAiUsage = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const usage = await ctx.db
      .query("userMonthlyAiUsage")
      .withIndex("by_user_month", (q) => q.eq("userId", userId).eq("month", currentMonth))
      .first();

    // Calculate when monthly limit resets (first day of next month)
    const nextMonth = new Date();
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    nextMonth.setUTCDate(1);
    nextMonth.setUTCHours(0, 0, 0, 0);

    // Calculate days until reset
    const now = new Date();
    const daysUntilReset = Math.ceil((nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const resetTime = `Resets in ${daysUntilReset}d`;
    const monthlyLimit = usage?.monthlyLimit ?? DEFAULT_MONTHLY_LIMIT;
    const monthlyCallsUsed = usage?.monthlyCallsUsed ?? 0;
    const remainingScores = Math.max(monthlyLimit - monthlyCallsUsed, 0);

    return {
      month: currentMonth,
      resetTime,
      resetTimestamp: nextMonth.getTime(),
      monthlyCallsUsed,
      monthlyLimit,
      remainingScores,
      isLimitReached: remainingScores <= 0,
    };
  },
});

// Internal query to get AI usage for a specific user (used by actions)
export const getAiUsageForUser = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    const dailyUsage = await ctx.db
      .query("userDailyAiUsage")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId).eq("date", today))
      .first();

    const monthlyUsage = await ctx.db
      .query("userMonthlyAiUsage")
      .withIndex("by_user_month", (q) => q.eq("userId", args.userId).eq("month", currentMonth))
      .first();

    return {
      daily: {
        date: today,
        aiCallsUsed: dailyUsage?.aiCallsUsed || 0,
        dailyLimit: dailyUsage?.dailyLimit || DEFAULT_DAILY_LIMIT,
        remainingScores: (dailyUsage?.dailyLimit || DEFAULT_DAILY_LIMIT) - (dailyUsage?.aiCallsUsed || 0),
      },
      monthly: {
        month: currentMonth,
        monthlyCallsUsed: monthlyUsage?.monthlyCallsUsed || 0,
        monthlyLimit: monthlyUsage?.monthlyLimit || DEFAULT_MONTHLY_LIMIT,
        remainingScores: (monthlyUsage?.monthlyLimit || DEFAULT_MONTHLY_LIMIT) - (monthlyUsage?.monthlyCallsUsed || 0),
      }
    };
  },
});

// Internal mutation to check limits and increment AI usage
export const checkAndIncrementAiUsage = internalMutation({
  args: {
    userId: v.id("users"),
    incrementBy: v.optional(v.number()), // Default to 1
  },
  handler: async (ctx, args) => {
    const incrementBy = args.incrementBy || 1;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const now = Date.now();

    // Get daily record
    const dailyUsage = await ctx.db
      .query("userDailyAiUsage")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId).eq("date", today))
      .first();

    // Get monthly record
    const monthlyUsage = await ctx.db
      .query("userMonthlyAiUsage")
      .withIndex("by_user_month", (q) => q.eq("userId", args.userId).eq("month", currentMonth))
      .first();

    const currentDailyUsage = dailyUsage?.aiCallsUsed || 0;
    const currentMonthlyUsage = monthlyUsage?.monthlyCallsUsed || 0;
    const dailyLimit = dailyUsage?.dailyLimit || DEFAULT_DAILY_LIMIT;
    const monthlyLimit = monthlyUsage?.monthlyLimit || DEFAULT_MONTHLY_LIMIT;

    // Check if incrementing would exceed limits
    if (currentDailyUsage + incrementBy > dailyLimit) {
      throw new Error(`Daily AI usage limit exceeded. Current: ${currentDailyUsage}, Limit: ${dailyLimit}, Requested: ${incrementBy}`);
    }

    if (currentMonthlyUsage + incrementBy > monthlyLimit) {
      throw new Error(`Monthly AI usage limit exceeded. Current: ${currentMonthlyUsage}, Limit: ${monthlyLimit}, Requested: ${incrementBy}`);
    }

    // Update or create daily usage record
    if (dailyUsage) {
      await ctx.db.patch(dailyUsage._id, {
        aiCallsUsed: currentDailyUsage + incrementBy,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("userDailyAiUsage", {
        userId: args.userId,
        date: today,
        aiCallsUsed: incrementBy,
        dailyLimit: DEFAULT_DAILY_LIMIT,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Update or create monthly usage record
    if (monthlyUsage) {
      await ctx.db.patch(monthlyUsage._id, {
        monthlyCallsUsed: currentMonthlyUsage + incrementBy,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("userMonthlyAiUsage", {
        userId: args.userId,
        month: currentMonth,
        monthlyCallsUsed: incrementBy,
        monthlyLimit: DEFAULT_MONTHLY_LIMIT,
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      success: true,
      newDailyUsage: currentDailyUsage + incrementBy,
      newMonthlyUsage: currentMonthlyUsage + incrementBy,
      dailyRemaining: dailyLimit - (currentDailyUsage + incrementBy),
      monthlyRemaining: monthlyLimit - (currentMonthlyUsage + incrementBy),
    };
  },
});

// Admin function to reset daily AI usage for a user
export const resetDailyAiUsage = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireAdminUser(ctx);
    const today = new Date().toISOString().split('T')[0];

    const usage = await ctx.db
      .query("userDailyAiUsage")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId).eq("date", today))
      .first();

    if (usage) {
      await ctx.db.patch(usage._id, {
        aiCallsUsed: 0,
        updatedAt: Date.now(),
      });
    }

    return { success: true, date: today };
  },
});

// Function to get user's AI limits (for future customization)
export const getUserAiLimits = query({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);

    // For now, return default limits
    // In the future, this could query user-specific limits from a settings table
    return {
      dailyLimit: DEFAULT_DAILY_LIMIT,
      monthlyLimit: DEFAULT_MONTHLY_LIMIT,
    };
  },
});

// Query to get daily jobs scraped count for authenticated user
export const getDailyJobsScraped = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    // Get start and end of today in UTC
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayStart = today.getTime();

    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const todayEnd = tomorrow.getTime();

    // Get all jobs created today by this user
    const scrapes = await ctx.db
      .query("jobScrapes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.and(
          q.gte(q.field("createdAt"), todayStart),
          q.lt(q.field("createdAt"), todayEnd)
        )
      )
      .collect();

    // Sum up total jobs from all scrapes today
    const totalJobsScraped = scrapes.reduce((sum, scrape) => sum + (scrape.totalJobs || 0), 0);

    // Calculate reset time (same as daily AI usage)
    const now = new Date();
    const hoursUntilReset = Math.ceil((todayEnd - now.getTime()) / (1000 * 60 * 60));
    const resetTime = `Resets in ${hoursUntilReset}h`;

    return {
      jobsScraped: totalJobsScraped,
      scrapesCount: scrapes.length,
      resetTime: resetTime,
    };
  },
});
