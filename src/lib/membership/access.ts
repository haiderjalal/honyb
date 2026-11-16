import "server-only";

import { logger } from "@/lib/logger";
import { getMembershipRepository } from "@/lib/supabase/membershipRepository";
import { getSignedInUser, type SignedInUser } from "@/lib/supabase/session";

/**
 * Access checks for membership pages. Always call these on the server before reading or writing membership data.
 * Client-side hiding is never a security control.
 */

/** The signed-in customer, or null when signed out or when membership storage is not configured. */
export async function getMemberAccount(): Promise<SignedInUser | null> {
  if (!getMembershipRepository()) return null;
  return getSignedInUser();
}

/** The signed-in user when they are a membership admin (listed in membership_admins), otherwise null. */
export async function getMembershipAdmin(): Promise<SignedInUser | null> {
  const repo = getMembershipRepository();
  if (!repo) return null;

  const user = await getSignedInUser();
  if (!user) return null;

  if (await repo.isAdmin(user.id)) return user;

  // A signed-in customer reached an admin check. Logged with the user id, which is a pseudonymous identifier.
  logger.warn("Admin area access denied", { event: "admin_access_denied", userId: user.id });
  return null;
}
