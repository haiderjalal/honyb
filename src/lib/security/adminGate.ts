/** Supabase keeps a signed-in session in cookies named sb-<project>-auth-token, split into numbered chunks when large. */
const SESSION_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

/**
 * True when an admin request should be refused before any admin page renders. A visitor with no session gets the same
 * 404 as an unknown page, with a real 404 status. The admin role is still checked on every page and action.
 */
export function refusesAdminRequest(pathname: string, cookieNames: string[]): boolean {
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  if (!isAdminPath) return false;
  return !cookieNames.some((name) => SESSION_COOKIE.test(name));
}
