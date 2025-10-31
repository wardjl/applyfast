"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { ScrapeCompletionEmail, HighScoringJobsEmail, NoHighScoringJobsEmail } from "./emailTemplates";
import { getOptionalUserId } from "./lib/auth";

// Lazy-load Resend to avoid module analysis errors
const getResendClient = () => new Resend(process.env.RESEND_API_KEY);
const APP_BASE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://applyfa.st").replace(/\/$/, "");
const DASHBOARD_ROOT = `${APP_BASE_URL}/dashboard`;

export const sendEmail = action({
  args: {
    to: v.array(v.string()),
    subject: v.string(),
    html: v.string(),
    from: v.optional(v.string()),
    replyTo: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    data: v.optional(v.any()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    try {
      const resend = getResendClient();
      const { data, error } = await resend.emails.send({
        from: args.from || " <notifications@applyfa.st>",
        to: args.to,
        subject: args.subject,
        html: args.html,
        replyTo: args.replyTo || "notifications@applyfa.st",
      });

      if (error) {
        console.error("Error sending email:", error);
        return {
          success: false,
          error: JSON.stringify(error),
        };
      }

      console.log("Email sent successfully:", data);
      return {
        success: true,
        data,
      };
    } catch (err) {
      console.error("Unexpected error sending email:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },
});

export const sendScrapeCompletionEmail = action({
  args: {
    scrapeName: v.string(),
    totalJobs: v.number(),
    scrapeId: v.string(),
    dashboardUrl: v.optional(v.string()),
    userEmail: v.optional(v.string()), // Add optional email for background operations
  },
  returns: v.object({
    success: v.boolean(),
    data: v.optional(v.any()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    try {
      let recipientEmail: string;

      // If email is provided directly (for background operations), use it
      if (args.userEmail) {
        recipientEmail = args.userEmail;
      } else {
        // Otherwise, get email from authenticated user (for interactive operations)
        const userId = await getOptionalUserId(ctx);
        if (!userId) {
          return {
            success: false,
            error: "User not authenticated and no email provided",
          };
        }

        const identity = await ctx.auth.getUserIdentity();
        if (!identity || !identity.email) {
          return {
            success: false,
            error: "User email not available",
          };
        }
        recipientEmail = identity.email;
      }

      const dashboardUrl =
        args.dashboardUrl ||
        `${DASHBOARD_ROOT}/jobs?scrape=${encodeURIComponent(args.scrapeId)}`;

      const emailHtml = await render(
        ScrapeCompletionEmail({
          scrapeName: args.scrapeName,
          totalJobs: args.totalJobs,
          dashboardUrl,
          scrapeId: args.scrapeId,
        })
      );

      const resend = getResendClient();
      const { data, error } = await resend.emails.send({
        from: "Apply Fast <notifications@applyfa.st>",
        to: [recipientEmail],
        subject: `Job Scrape Complete: ${args.scrapeName} - ${args.totalJobs} jobs found`,
        html: emailHtml,
        replyTo: "notifications@applyfa.st",
      });

      if (error) {
        console.error("Error sending scrape completion email:", error);
        return {
          success: false,
          error: JSON.stringify(error),
        };
      }

      console.log("Scrape completion email sent successfully:", data);
      return {
        success: true,
        data,
      };
    } catch (err) {
      console.error("Unexpected error sending scrape completion email:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },
});

export const sendHighScoringJobsEmail = action({
  args: {
    jobs: v.array(v.object({
      jobId: v.string(),
      title: v.string(),
      company: v.string(),
      url: v.string(),
      aiScore: v.number(),
      applyUrl: v.optional(v.string()),
    })),
    totalJobsScraped: v.number(),
    userEmail: v.string(),
    scrapeName: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    data: v.optional(v.any()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    try {
      if (args.jobs.length === 0) {
        return {
          success: false,
          error: "No high-scoring jobs to send",
        };
      }

      const emailHtml = await render(
        HighScoringJobsEmail({
          jobs: args.jobs,
          totalJobsScraped: args.totalJobsScraped,
          userEmail: args.userEmail,
          scrapeName: args.scrapeName,
        })
      );

      const scrapeNameSuffix = args.scrapeName ? ` from "${args.scrapeName}"` : "";
      const resend = getResendClient();
      const { data, error } = await resend.emails.send({
        from: "Apply Fast <notifications@applyfa.st>",
        to: [args.userEmail],
        subject: `${args.jobs.length} Jobs Found${scrapeNameSuffix}`,
        html: emailHtml,
        replyTo: "notifications@applyfa.st",
      });

      if (error) {
        console.error("Error sending high-scoring jobs email:", error);
        return {
          success: false,
          error: JSON.stringify(error),
        };
      }

      console.log("High-scoring jobs email sent successfully:", data);
      return {
        success: true,
        data,
      };
    } catch (err) {
      console.error("Unexpected error sending high-scoring jobs email:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },
});

export const sendNoHighScoringJobsEmail = action({
  args: {
    totalJobsScraped: v.number(),
    scrapeName: v.string(),
    dashboardUrl: v.string(),
    userEmail: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    data: v.optional(v.any()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    try {
      const emailHtml = await render(
        NoHighScoringJobsEmail({
          totalJobsScraped: args.totalJobsScraped,
          scrapeName: args.scrapeName,
          dashboardUrl: args.dashboardUrl,
        })
      );

      const resend = getResendClient();
      const { data, error } = await resend.emails.send({
        from: "Apply Fast <notifications@applyfa.st>",
        to: [args.userEmail],
        subject: `Job Search Update: "${args.scrapeName}" - ${args.totalJobsScraped} jobs processed`,
        html: emailHtml,
        replyTo: "notifications@applyfa.st",
      });

      if (error) {
        console.error("Error sending no high-scoring jobs email:", error);
        return {
          success: false,
          error: JSON.stringify(error),
        };
      }

      console.log("No high-scoring jobs email sent successfully:", data);
      return {
        success: true,
        data,
      };
    } catch (err) {
      console.error("Unexpected error sending no high-scoring jobs email:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },
});
