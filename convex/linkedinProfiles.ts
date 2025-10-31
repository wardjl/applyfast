import { v } from "convex/values";
import {
  mutation,
  query,
  internalQuery,
  internalMutation,
  action,
  internalAction,
  MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { getOptionalUserId, requireUserId } from "./lib/auth";

const RELEVANCE_ENDPOINT =
  "https://api-d7b62b.stack.tryrelevance.com/latest/studios/e3df8944-dda8-47bb-bc6a-2950def30c1c/trigger_webhook?project=ebeabd60-4b92-4711-86aa-0790b4db533e";

const REQUIRED_FIELDS = ["userId", "linkedinUrl", "updatedAt"] as const;

type RequiredField = (typeof REQUIRED_FIELDS)[number];

const REQUIRED_FIELD_LIST: RequiredField[] = [...REQUIRED_FIELDS];

export const upsertLinkedInProfile = mutation({
  args: {
    profileData: v.any(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    return upsertForUser(ctx, userId, args.profileData);
  },
});

export const upsertLinkedInProfileInternal = internalMutation({
  args: {
    userId: v.id("users"),
    profileData: v.any(),
  },
  handler: async (ctx, args) => {
    return upsertForUser(ctx, args.userId, args.profileData);
  },
});

export const importLinkedInProfile = action({
  args: {
    linkedinUrl: v.string(),
  },
  handler: async (ctx, args): Promise<Doc<"linkedinProfiles"> | null> => {
    const userId = await requireUserId(ctx);

    return ctx.runAction(internal.linkedinProfiles.importLinkedInProfileInternal, {
      userId,
      linkedinUrl: args.linkedinUrl,
    });
  },
});

export const importLinkedInProfileInternal = internalAction({
  args: {
    userId: v.id("users"),
    linkedinUrl: v.string(),
  },
  handler: async (ctx, args): Promise<Doc<"linkedinProfiles"> | null> => {
    const apiKey = process.env.RELEVANCE_API_KEY;
    if (!apiKey) {
      throw new Error("Missing Relevance API key. Set RELEVANCE_API_KEY in the environment.");
    }

    const normalizedUrl = normalizeLinkedInUrl(args.linkedinUrl);

    let responseText: string;
    let payload: any = null;

    try {
      const response = await fetch(RELEVANCE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: apiKey,
        },
        body: JSON.stringify({ url: normalizedUrl }),
      });

      responseText = await response.text();

      try {
        payload = responseText ? JSON.parse(responseText) : null;
      } catch (parseError) {
        payload = null;
      }

      const isSuccess = response.ok && payload?.status === 200 && payload?.data;
      if (!isSuccess) {
        const message =
          payload?.error ||
          payload?.message ||
          payload?.data?.message ||
          `Failed with status ${response.status}`;
        throw new Error(typeof message === "string" && message.length > 0 ? message : "Failed to import LinkedIn profile");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unhandled error while importing LinkedIn profile";
      throw new Error(message);
    }

    const profileData = {
      ...payload.data,
      linkedinUrl: payload.data.linkedin_url ?? normalizedUrl,
    };

    await ctx.runMutation(internal.linkedinProfiles.upsertLinkedInProfileInternal, {
      userId: args.userId,
      profileData,
    });

    return ctx.runQuery(internal.linkedinProfiles.getLinkedInProfileInternal, { userId: args.userId });
  },
});

export const getLinkedInProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalUserId(ctx);
    if (!userId) {
      return null;
    }

    const profile = await ctx.db
      .query("linkedinProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return profile;
  },
});

export const deleteLinkedInProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);


    const profile = await ctx.db
      .query("linkedinProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (profile) {
      await ctx.db.delete(profile._id);
      return { success: true };
    }

    return { success: false, message: "No profile found" };
  },
});

export const getLinkedInProfileInternal = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("linkedinProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    return profile;
  },
});

async function upsertForUser(ctx: MutationCtx, userId: Id<"users">, rawData: any) {
  if (!rawData || typeof rawData !== "object") {
    throw new Error("Invalid LinkedIn profile payload");
  }

  const now = Date.now();

  const publicIdentifier = pickString(rawData, ["publicIdentifier", "public_id"]);
  const rawLinkedInUrl =
    pickString(rawData, ["linkedinUrl", "linkedin_url", "url", "profileUrl", "profile_url"]) ||
    (publicIdentifier ? `https://www.linkedin.com/in/${publicIdentifier}` : undefined);

  if (!rawLinkedInUrl) {
    throw new Error("LinkedIn URL missing from profile data");
  }

  const linkedinUrl = normalizeLinkedInUrl(rawLinkedInUrl);

  const addressWithoutCountry =
    pickString(rawData, ["addressWithoutCountry"]) || buildCityState(rawData);
  const addressWithCountry =
    pickString(rawData, ["addressWithCountry", "location"]) ||
    buildAddressWithCountry(addressWithoutCountry, rawData);

  const profileRecord = filterNullish(
    {
      userId,
      linkedinUrl,
      updatedAt: now,
      firstName: pickString(rawData, ["firstName", "first_name"]),
      lastName: pickString(rawData, ["lastName", "last_name"]),
      fullName: pickString(rawData, ["fullName", "full_name"]),
      headline: pickString(rawData, ["headline"]),
      connections: pickNumber(rawData, ["connections", "connection_count"]),
      followers: pickNumber(rawData, ["followers", "follower_count"]),
      email: pickString(rawData, ["email"]),
      mobileNumber: pickString(rawData, ["mobileNumber", "phone"]),
      jobTitle: pickString(rawData, ["jobTitle", "job_title"]),
      companyName: pickString(rawData, ["companyName", "company"]),
      companyIndustry: pickString(rawData, ["companyIndustry", "company_industry"]),
      companyWebsite: ensureHttps(
        pickString(rawData, ["companyWebsite", "company_website", "company_domain"]),
      ),
      companyLinkedin: ensureHttps(
        pickString(rawData, ["companyLinkedin", "company_linkedin_url"]),
      ),
      companyFoundedIn: pickNumber(rawData, ["companyFoundedIn", "company_year_founded"]),
      companySize: pickString(rawData, ["companySize", "company_employee_range"]),
      currentJobDuration: pickString(rawData, ["currentJobDuration", "current_job_duration"]),
      currentJobDurationInYrs:
        pickNumber(rawData, ["currentJobDurationInYrs"]) ||
        computeDurationYears(
          pickNumber(rawData, ["current_company_join_year"]),
          pickNumber(rawData, ["current_company_join_month"]),
        ),
      topSkillsByEndorsements: pickString(rawData, ["topSkillsByEndorsements"]),
      addressCountryOnly: pickString(rawData, ["addressCountryOnly", "country"]),
      addressWithCountry,
      addressWithoutCountry,
      profilePic: ensureHttps(pickString(rawData, ["profilePic", "profile_image_url"])),
      profilePicHighQuality: ensureHttps(
        pickString(rawData, ["profilePicHighQuality", "profile_image_url"]),
      ),
      about: pickString(rawData, ["about", "summary"]),
      publicIdentifier,
      openConnection: rawData.openConnection,
      urn: pickString(rawData, ["urn"]),
      experiences: normalizeExperiences(rawData),
      skills: normalizeSkills(rawData),
      educations: normalizeEducations(rawData),
      licenseAndCertificates: normalizeCertificates(rawData),
      publications:
        Array.isArray(rawData.publications) && rawData.publications.length > 0
          ? rawData.publications
          : undefined,
      profilePicAllDimensions:
        Array.isArray(rawData.profilePicAllDimensions) && rawData.profilePicAllDimensions.length > 0
          ? rawData.profilePicAllDimensions
          : undefined,
      rawData,
    },
    REQUIRED_FIELD_LIST,
  );

  const existingProfile = await ctx.db
    .query("linkedinProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (existingProfile) {
    await ctx.db.patch(existingProfile._id, profileRecord as any);
    return existingProfile._id;
  }

  const profileId = await ctx.db.insert("linkedinProfiles", {
    ...profileRecord,
    createdAt: now,
  } as any);

  return profileId;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function asNonEmptyString<T = string>(value: unknown): string | undefined {
  if (isNonEmptyString(value)) {
    return value.trim();
  }
  return undefined;
}

function ensureHttps(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("mailto:")) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^http:\/\//i, "https://");
  }
  return `https://${trimmed}`;
}

function normalizeLinkedInUrl(raw: string): string {
  if (!isNonEmptyString(raw)) {
    throw new Error("LinkedIn URL is required");
  }

  let url = raw.trim();

  if (!/^https?:\/\//i.test(url)) {
    if (url.startsWith("www.")) {
      url = `https://${url}`;
    } else if (url.startsWith("linkedin.com")) {
      url = `https://${url}`;
    } else if (!url.includes(".")) {
      url = url.replace(/^\/+/, "").replace(/\/+$/, "");
      url = `https://www.linkedin.com/in/${url}`;
    } else {
      url = `https://${url}`;
    }
  }

  return url.replace(/^http:\/\//i, "https://");
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const numeric = Number(trimmed.replace(/[^0-9.-]/g, ""));
    if (!Number.isNaN(numeric)) {
      return numeric;
    }
  }
  return undefined;
}

function pickString(data: any, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = data?.[key];
    const stringValue = asNonEmptyString(value);
    if (stringValue !== undefined) {
      return stringValue;
    }
  }
  return undefined;
}

function pickNumber(data: any, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = data?.[key];
    const numericValue = parseNumber(value);
    if (numericValue !== undefined) {
      return numericValue;
    }
  }
  return undefined;
}

function buildCityState(data: any): string | undefined {
  const city = pickString(data, ["city"]);
  const state = pickString(data, ["state"]);
  const parts = [city, state].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function buildAddressWithCountry(addressWithoutCountry: string | undefined, data: any): string | undefined {
  const country = pickString(data, ["country", "addressCountryOnly"]);
  const parts = [addressWithoutCountry, country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function computeDurationYears(year?: number, month?: number): number | undefined {
  if (!year || !Number.isFinite(year)) {
    return undefined;
  }

  const monthIndex = month && Number.isFinite(month) ? Math.max(0, Math.min(11, month - 1)) : 0;
  const joinDate = new Date(year, monthIndex, 1);
  if (Number.isNaN(joinDate.getTime())) {
    return undefined;
  }

  const diffMs = Date.now() - joinDate.getTime();
  if (diffMs <= 0) {
    return undefined;
  }

  const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);
  return Math.round(diffYears * 100) / 100;
}

function isApifyExperienceShape(exp: any): boolean {
  if (!exp || typeof exp !== "object") return false;
  return (
    Object.prototype.hasOwnProperty.call(exp, "subtitle") ||
    Object.prototype.hasOwnProperty.call(exp, "caption") ||
    Object.prototype.hasOwnProperty.call(exp, "metadata") ||
    Object.prototype.hasOwnProperty.call(exp, "subComponents")
  );
}

function normalizeExperiences(data: any): any[] | undefined {
  const raw = Array.isArray(data?.experiences) ? data.experiences : undefined;
  if (!raw || raw.length === 0) {
    return undefined;
  }

  if (raw.every(isApifyExperienceShape)) {
    return raw;
  }

  const normalized = raw
    .map((exp: any) => {
      if (!exp || typeof exp !== "object") return undefined;

      const title = pickString(exp, ["title", "job_title", "jobTitle"]) || pickString(exp, ["company"]);
      const subtitleParts = [pickString(exp, ["company"]), pickString(exp, ["job_type", "jobType"])].filter(Boolean);
      const captionParts = [pickString(exp, ["date_range", "dateRange"]), pickString(exp, ["duration"])].filter(Boolean);
      const descriptionText = pickString(exp, ["description"]);

      return {
        companyId: pickString(exp, ["company_id", "companyId"]),
        companyLink1: ensureHttps(pickString(exp, ["company_linkedin_url", "companyLink1"])),
        logo: pickString(exp, ["company_logo_url", "logo"]),
        title: title || undefined,
        subtitle: subtitleParts.length > 0 ? subtitleParts.join(" · ") : undefined,
        caption: captionParts.length > 0 ? captionParts.join(" · ") : undefined,
        metadata: pickString(exp, ["location", "metadata"]),
        breakdown: false,
        subComponents: [
          {
            description:
              descriptionText && descriptionText.length > 0
                ? [{ type: "textComponent", text: descriptionText }]
                : [],
          },
        ],
      };
    })
    .filter((exp: any) => exp && (exp.title || exp.subtitle || exp.caption || exp.metadata));

  return normalized.length > 0 ? normalized : undefined;
}

function isApifyEducationShape(entry: any): boolean {
  if (!entry || typeof entry !== "object") return false;
  return (
    Object.prototype.hasOwnProperty.call(entry, "subtitle") ||
    Object.prototype.hasOwnProperty.call(entry, "caption") ||
    Object.prototype.hasOwnProperty.call(entry, "subComponents")
  );
}

function normalizeEducations(data: any): any[] | undefined {
  const raw = Array.isArray(data?.educations) ? data.educations : undefined;
  if (!raw || raw.length === 0) {
    return undefined;
  }

  if (raw.every(isApifyEducationShape)) {
    return raw;
  }

  const normalized = raw
    .map((edu: any) => {
      if (!edu || typeof edu !== "object") return undefined;

      const subtitleParts = [pickString(edu, ["degree"]), pickString(edu, ["field_of_study", "fieldOfStudy"])]
        .filter(Boolean)
        .join(", ");
      const activities = pickString(edu, ["activities"]);

      return {
        companyId: pickString(edu, ["school_id", "companyId"]),
        companyLink1: ensureHttps(pickString(edu, ["school_linkedin_url", "companyLink1"])),
        logo: pickString(edu, ["school_logo_url", "logo"]),
        title: pickString(edu, ["school", "title"]),
        subtitle: subtitleParts || pickString(edu, ["subtitle"]),
        caption: pickString(edu, ["date_range", "caption"]),
        breakdown: false,
        subComponents: [
          {
            description:
              activities && activities.length > 0
                ? [{ type: "textComponent", text: activities }]
                : [],
          },
        ],
      };
    })
    .filter((edu: any) => edu && edu.title);

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeSkills(data: any): any[] | undefined {
  if (Array.isArray(data?.skills) && data.skills.length > 0) {
    return data.skills;
  }

  if (Array.isArray(data?.languages) && data.languages.length > 0) {
    const normalized = data.languages
      .map((lang: any) => {
        if (typeof lang === "string") {
          const title = asNonEmptyString(lang);
          if (title) {
            return {
              title,
              subComponents: [
                {
                  description: [],
                },
              ],
            };
          }
          return undefined;
        }

        const title = pickString(lang, ["title", "name", "language"]);
        if (!title) return undefined;
        return {
          title,
          subComponents: [
            {
              description: [],
            },
          ],
        };
      })
      .filter(Boolean);

    return normalized.length > 0 ? normalized : undefined;
  }

  return undefined;
}

function normalizeCertificates(data: any): any[] | undefined {
  if (Array.isArray(data?.licenseAndCertificates) && data.licenseAndCertificates.length > 0) {
    return data.licenseAndCertificates;
  }

  const fallback = Array.isArray(data?.certifications)
    ? data.certifications
    : Array.isArray(data?.licenses)
      ? data.licenses
      : undefined;

  if (!fallback || fallback.length === 0) {
    return undefined;
  }

  const normalized = fallback
    .map((cert: any) => {
      if (!cert || typeof cert !== "object") return undefined;

      const title = pickString(cert, ["title", "name"]);
      if (!title) return undefined;

      const subtitle = pickString(cert, ["subtitle", "issuer", "authority"]);
      const caption = pickString(cert, ["caption", "date_range", "issued" ]);
      const credentialId = pickString(cert, ["credential_id", "credentialId"]);

      return {
        logo: pickString(cert, ["logo", "logo_url"]),
        title,
        subtitle,
        caption,
        metadata: credentialId ? `Credential ID ${credentialId}` : pickString(cert, ["metadata"]),
        breakdown: false,
        subComponents: [
          {
            description: [],
          },
        ],
      };
    })
    .filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
}

function filterNullish(obj: Record<string, any>, requiredFields: RequiredField[]) {
  const filtered: Record<string, any> = {};
  const required = new Set(requiredFields);

  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined) {
      filtered[key] = value;
    } else if (required.has(key as RequiredField)) {
      filtered[key] = value;
    }
  }

  return filtered;
}
