import { getAuthUserId } from "@convex-dev/auth/server";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

type AuthenticatedCtx = QueryCtx | MutationCtx | ActionCtx;

const adminUserEnvVar = "ADMIN_USER_IDS";

/**
 * Resolve the authenticated user id if present. Returns null when the caller
 * is anonymous or the referenced user document no longer exists.
 */
export async function getOptionalUserId(ctx: AuthenticatedCtx): Promise<Id<"users"> | null> {
  const authUserId = await getAuthUserId(ctx);
  if (!authUserId) {
    return null;
  }

  // Actions don't have db, so we can't normalize the ID
  // For actions, return the authUserId as-is (it should already be valid)
  if (!("db" in ctx)) {
    return authUserId as Id<"users">;
  }

  return ctx.db.normalizeId("users", authUserId);
}

/**
 * Resolve and validate the authenticated Convex user id.
 * Normalizes the id to ensure the corresponding user document exists.
 */
export async function requireUserId(ctx: AuthenticatedCtx): Promise<Id<"users">> {
  const normalizedId = await getOptionalUserId(ctx);
  if (!normalizedId) {
    throw new Error("Authenticated user record not found");
  }

  return normalizedId;
}

/**
 * Ensure the caller is an administrator. Administrator ids are sourced from the
 * comma-separated ADMIN_USER_IDS environment variable. Returns the validated
 * admin user id for convenience.
 */
export async function requireAdminUser(ctx: AuthenticatedCtx): Promise<Id<"users">> {
  const userId = await requireUserId(ctx);
  const adminIds = (process.env[adminUserEnvVar] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (adminIds.length === 0) {
    throw new Error("Admin access is not configured");
  }

  if (!adminIds.includes(userId)) {
    throw new Error("Administrator privileges required");
  }

  return userId;
}
