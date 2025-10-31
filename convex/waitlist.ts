import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Add email to waitlist
export const addToWaitlist = mutation({
  args: {
    email: v.string(),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.email)) {
      throw new Error("Invalid email address");
    }

    // Normalize email to lowercase
    const normalizedEmail = args.email.toLowerCase().trim();

    // Check if email already exists
    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (existing) {
      return { success: true, alreadyExists: true, id: existing._id };
    }

    // Add to waitlist
    const waitlistId = await ctx.db.insert("waitlist", {
      email: normalizedEmail,
      createdAt: Date.now(),
      source: args.source,
    });

    return { success: true, alreadyExists: false, id: waitlistId };
  },
});

// Get total waitlist count (for display on landing page)
export const getWaitlistCount = query({
  args: {},
  handler: async (ctx) => {
    const allEntries = await ctx.db.query("waitlist").collect();
    return allEntries.length;
  },
});
