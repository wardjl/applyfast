import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import { DEFAULT_SCORING_CRITERIA } from "../lib/constants";
import { getOptionalUserId, requireUserId } from "./lib/auth";

// Query to get the current user's profile
export const getUserProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return profile;
  },
});

// Mutation to create or update user profile
export const upsertUserProfile = mutation({
  args: {
    idealJobTitle: v.optional(v.string()),
    skills: v.optional(v.array(v.string())),
    experience: v.optional(v.string()),
    preferredLocation: v.optional(v.string()),
    workArrangement: v.optional(v.union(v.literal("remote"), v.literal("hybrid"), v.literal("onsite"), v.literal("flexible"))),
    salaryRange: v.optional(v.string()),
    industryPreferences: v.optional(v.array(v.string())),
    companySize: v.optional(v.string()),
    careerGoals: v.optional(v.string()),
    roleRequirements: v.optional(v.array(v.string())),
    dealBreakers: v.optional(v.array(v.string())),
    additionalNotes: v.optional(v.string()),
    careerNarrative: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    // Check if profile already exists
    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const now = Date.now();

    if (existingProfile) {
      // Update existing profile
      await ctx.db.patch(existingProfile._id, {
        ...args,
        updatedAt: now,
      });
      return existingProfile._id;
    } else {
      // Create new profile
      const profileId = await ctx.db.insert("userProfiles", {
        userId,
        ...args,
        createdAt: now,
        updatedAt: now,
      });
      return profileId;
    }
  },
});

// Internal query to get user profile by userId (for use in actions)
export const getUserProfileInternal = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    return profile;
  },
});

// Query to get all scoring context (profile, interview summary, custom criteria)
// This is used by the Chrome extension to load all scoring data at once
export const getScoringContext = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalUserId(ctx);
    if (!userId) {
      return null;
    }

    const [userProfile, interviewData, scoringPrompt] = await Promise.all([
      ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first(),
      ctx.db
        .query("jobPreferenceInterviews")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", userId).eq("status", "completed")
        )
        .order("desc")
        .first(),
      ctx.db
        .query("aiScoringPrompts")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first(),
    ]);

    return {
      userProfile: userProfile ?? null,
      interviewSummary: interviewData?.summary ?? null,
      customScoringCriteria:
        scoringPrompt?.useCustomPrompt && scoringPrompt?.customPrompt
          ? scoringPrompt.customPrompt
          : null,
      defaultScoringCriteria: DEFAULT_SCORING_CRITERIA,
    };
  },
});
