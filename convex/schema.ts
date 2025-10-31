import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.
export default defineSchema({
  ...authTables,
  userProfiles: defineTable({
    userId: v.id("users"),
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
    createdAt: v.number(),
    updatedAt: v.number(),
    apifyApiToken: v.optional(v.string()),
  }).index("by_user", ["userId"]),
  recurringJobScrapes: defineTable({
    name: v.string(),
    location: v.optional(v.string()),
    linkedinUrl: v.string(),
    apifyApiToken: v.optional(v.string()),
    enabled: v.boolean(),
    userId: v.id("users"),
    userEmail: v.optional(v.string()), // Store user email for background notifications (optional for backward compatibility)
    // Schedule configuration
    frequency: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
    dayOfWeek: v.optional(v.number()), // 0-6 for weekly (0 = Sunday)
    dayOfMonth: v.optional(v.number()), // 1-31 for monthly
    hour: v.number(), // 0-23
    minute: v.number(), // 0-59
    // Legacy email fields (for backward compatibility)
    digestEnabled: v.optional(v.boolean()),
    digestHour: v.optional(v.number()),
    digestMinute: v.optional(v.number()),
    digestScheduledFunctionId: v.optional(v.id("_scheduled_functions")),
    lastDigestSent: v.optional(v.number()),
    // New email notification settings
    emailSettings: v.optional(v.object({
      enabled: v.boolean(),
      timing: v.union(v.literal("auto"), v.literal("manual")),
      delayMinutes: v.number(), // Minutes after scrape completion for auto timing
      manualTime: v.optional(v.object({
        hour: v.number(), // 0-23
        minute: v.number(), // 0-59
      })),
    })),
    // Execution tracking
    lastRun: v.optional(v.number()),
    nextRun: v.optional(v.number()),
    scheduledFunctionId: v.optional(v.id("_scheduled_functions")),
    createdAt: v.number(),
  }).index("by_user", ["userId"]).index("by_enabled", ["enabled"]),
  jobScrapes: defineTable({
    name: v.string(),
    linkedinUrl: v.optional(v.string()), // Optional for backward compatibility
    searchQuery: v.optional(v.string()), // Keep old field for existing data
    apifyRunId: v.optional(v.string()),
    isManual: v.optional(v.boolean()),
    status: v.union(v.literal("pending"), v.literal("running"), v.literal("completed"), v.literal("scoring"), v.literal("scoring_paused"), v.literal("failed")),
    totalJobs: v.optional(v.number()),
    totalJobsToScore: v.optional(v.number()), // Number of jobs that need AI scoring
    jobsScored: v.optional(v.number()), // Number of jobs that have been AI scored
    userId: v.id("users"),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  }).index("by_user", ["userId"]).index("by_status", ["status"]),
  jobs: defineTable({
    scrapeId: v.id("jobScrapes"),
    title: v.string(),
    company: v.string(),
    location: v.optional(v.string()),
    description: v.optional(v.string()),
    url: v.string(),
    salary: v.optional(v.string()),
    employmentType: v.optional(v.string()),
    experienceLevel: v.optional(v.string()),
    industry: v.optional(v.string()),
    companySize: v.optional(v.string()),
    postedDate: v.optional(v.string()),
    applyUrl: v.optional(v.string()),
    rawData: v.optional(v.any()), // Store the full Apify response for this job
    selected: v.optional(v.boolean()), // For AI selection later
    manualCapture: v.optional(v.boolean()),
    manualCapturedAt: v.optional(v.number()),
    manualCapturedBy: v.optional(v.string()),
    aiScore: v.optional(v.number()), // AI-generated score from 1-10
    aiDescription: v.optional(v.string()), // AI-generated explanation for the score
    aiRequirementChecks: v.optional(v.array(v.object({
      requirement: v.string(),
      score: v.number(), // 0 or 1
    }))), // AI-validated role requirements (binary: job meets requirement or not)
    aiScoredAt: v.optional(v.number()), // Timestamp when AI scoring was performed
    userId: v.optional(v.id("users")),
    linkedinJobId: v.optional(v.string()),
    linkedinCanonicalUrl: v.optional(v.string()),
  })
    .index("by_scrape", ["scrapeId"])
    .index("by_company", ["company"])
    .index("by_selected", ["selected"])
    .index("by_ai_score", ["aiScore"])
    .index("by_url", ["url"])
    .index("by_user_linkedin_job_id", ["userId", "linkedinJobId"])
    .index("by_user_linkedin_url", ["userId", "linkedinCanonicalUrl"]),
  // Daily AI usage tracking (one record per user per day)
  userDailyAiUsage: defineTable({
    userId: v.id("users"),
    date: v.string(), // Format: "YYYY-MM-DD"
    aiCallsUsed: v.number(), // Number of AI calls used today
    dailyLimit: v.number(), // Daily limit for this user
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user_date", ["userId", "date"]),

  // Monthly AI usage tracking (one record per user per month)
  userMonthlyAiUsage: defineTable({
    userId: v.id("users"),
    month: v.string(), // Format: "YYYY-MM"
    monthlyCallsUsed: v.number(), // Cumulative AI calls used this month
    monthlyLimit: v.number(), // Monthly limit for this user
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user_month", ["userId", "month"]),

  // Custom AI scoring prompts (one record per user)
  aiScoringPrompts: defineTable({
    userId: v.id("users"),
    customPrompt: v.optional(v.string()), // User's custom scoring criteria section
    useCustomPrompt: v.boolean(), // Toggle to use custom vs default
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Waitlist for landing page
  waitlist: defineTable({
    email: v.string(),
    createdAt: v.number(),
    source: v.optional(v.string()), // Track where signup came from
  }).index("by_email", ["email"]),

  // LinkedIn profile data
  linkedinProfiles: defineTable({
    userId: v.id("users"),
    linkedinUrl: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    fullName: v.optional(v.string()),
    headline: v.optional(v.string()),
    connections: v.optional(v.number()),
    followers: v.optional(v.number()),
    email: v.optional(v.string()),
    mobileNumber: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    companyName: v.optional(v.string()),
    companyIndustry: v.optional(v.string()),
    companyWebsite: v.optional(v.string()),
    companyLinkedin: v.optional(v.string()),
    companyFoundedIn: v.optional(v.number()),
    companySize: v.optional(v.string()),
    currentJobDuration: v.optional(v.string()),
    currentJobDurationInYrs: v.optional(v.number()),
    topSkillsByEndorsements: v.optional(v.string()),
    addressCountryOnly: v.optional(v.string()),
    addressWithCountry: v.optional(v.string()),
    addressWithoutCountry: v.optional(v.string()),
    profilePic: v.optional(v.string()),
    profilePicHighQuality: v.optional(v.string()),
    about: v.optional(v.string()),
    publicIdentifier: v.optional(v.string()),
    openConnection: v.optional(v.any()),
    urn: v.optional(v.string()),
    experiences: v.optional(v.any()), // Store full experiences array
    skills: v.optional(v.any()), // Store full skills array
    educations: v.optional(v.any()), // Store full educations array
    licenseAndCertificates: v.optional(v.any()), // Store full certificates array
    publications: v.optional(v.any()), // Store full publications array
    profilePicAllDimensions: v.optional(v.any()), // Store all profile picture sizes
    rawData: v.optional(v.any()), // Store the complete LinkedIn data
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
  jobPreferenceInterviews: defineTable({
    userId: v.id("users"),
    status: v.union(
      v.literal("in_progress"),
      v.literal("awaiting_confirmation"),
      v.literal("completed"),
    ),
    questions: v.array(v.object({
      id: v.number(),
      question: v.string(),
      focus: v.optional(v.string()),
    })),
    responses: v.optional(v.array(v.object({
      id: v.number(),
      question: v.string(),
      answer: v.string(),
      updatedAt: v.number(),
    }))),
    generatedPreferences: v.optional(v.object({
      idealJobTitle: v.optional(v.string()),
      skills: v.optional(v.array(v.string())),
      experience: v.optional(v.string()),
      preferredLocation: v.optional(v.string()),
      workArrangement: v.optional(v.union(
        v.literal("remote"),
        v.literal("hybrid"),
        v.literal("onsite"),
        v.literal("flexible"),
      )),
      salaryRange: v.optional(v.string()),
      industryPreferences: v.optional(v.array(v.string())),
      companySize: v.optional(v.string()),
      careerGoals: v.optional(v.string()),
      roleRequirements: v.optional(v.array(v.string())),
      dealBreakers: v.optional(v.array(v.string())),
      additionalNotes: v.optional(v.string()),
    })),
    summary: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_user_status", ["userId", "status"]),
});
