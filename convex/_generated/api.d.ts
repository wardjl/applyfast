/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as aiScoringPrompts from "../aiScoringPrompts.js";
import type * as aiUsageTracking from "../aiUsageTracking.js";
import type * as apifyActions from "../apifyActions.js";
import type * as auth from "../auth.js";
import type * as dataInspection from "../dataInspection.js";
import type * as email from "../email.js";
import type * as emailTemplates from "../emailTemplates.js";
import type * as http from "../http.js";
import type * as jobPreferenceInterviews from "../jobPreferenceInterviews.js";
import type * as jobScoringStream from "../jobScoringStream.js";
import type * as jobScoringUtils from "../jobScoringUtils.js";
import type * as jobScraping_helpers from "../jobScraping/helpers.js";
import type * as jobScraping from "../jobScraping.js";
import type * as lib_auth from "../lib/auth.js";
import type * as linkedinProfiles from "../linkedinProfiles.js";
import type * as locationValidation from "../locationValidation.js";
import type * as recurringJobScrapes from "../recurringJobScrapes.js";
import type * as userProfiles from "../userProfiles.js";
import type * as waitlist from "../waitlist.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  aiScoringPrompts: typeof aiScoringPrompts;
  aiUsageTracking: typeof aiUsageTracking;
  apifyActions: typeof apifyActions;
  auth: typeof auth;
  dataInspection: typeof dataInspection;
  email: typeof email;
  emailTemplates: typeof emailTemplates;
  http: typeof http;
  jobPreferenceInterviews: typeof jobPreferenceInterviews;
  jobScoringStream: typeof jobScoringStream;
  jobScoringUtils: typeof jobScoringUtils;
  "jobScraping/helpers": typeof jobScraping_helpers;
  jobScraping: typeof jobScraping;
  "lib/auth": typeof lib_auth;
  linkedinProfiles: typeof linkedinProfiles;
  locationValidation: typeof locationValidation;
  recurringJobScrapes: typeof recurringJobScrapes;
  userProfiles: typeof userProfiles;
  waitlist: typeof waitlist;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
