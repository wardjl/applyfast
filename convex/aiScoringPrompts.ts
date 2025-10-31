import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import { DEFAULT_SCORING_CRITERIA } from "../lib/constants";
import { requireUserId } from "./lib/auth";

// Query to get the current user's AI scoring prompt settings
export const getAiScoringPrompt = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    const promptSettings = await ctx.db
      .query("aiScoringPrompts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return promptSettings;
  },
});

// Mutation to create or update AI scoring prompt settings
export const upsertAiScoringPrompt = mutation({
  args: {
    customPrompt: v.optional(v.string()),
    useCustomPrompt: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    // Validate that if useCustomPrompt is true, customPrompt must be provided and not empty
    if (args.useCustomPrompt && (!args.customPrompt || args.customPrompt.trim().length === 0)) {
      throw new Error("Custom prompt cannot be empty when custom prompt is enabled");
    }

    // Check if settings already exist
    const existingSettings = await ctx.db
      .query("aiScoringPrompts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const now = Date.now();

    if (existingSettings) {
      // Update existing settings
      await ctx.db.patch(existingSettings._id, {
        customPrompt: args.customPrompt,
        useCustomPrompt: args.useCustomPrompt,
        updatedAt: now,
      });
      return existingSettings._id;
    } else {
      // Create new settings
      const settingsId = await ctx.db.insert("aiScoringPrompts", {
        userId,
        customPrompt: args.customPrompt,
        useCustomPrompt: args.useCustomPrompt,
        createdAt: now,
        updatedAt: now,
      });
      return settingsId;
    }
  },
});

// Internal query to get AI scoring prompt settings by userId (for use in actions)
export const getAiScoringPromptInternal = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const promptSettings = await ctx.db
      .query("aiScoringPrompts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    return promptSettings;
  },
});
