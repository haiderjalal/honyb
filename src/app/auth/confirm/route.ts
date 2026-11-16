import { NextResponse, type NextRequest } from "next/server";

import { logger } from "@/lib/logger";
import { safeInternalPath } from "@/lib/security/safeRedirect";
import { createSessionClient } from "@/lib/supabase/session";

const DEFAULT_DESTINATION = "/membership/account";

/**
 * Completes the email sign-in link. The email template links here with the one-time token hash, and the token is
 * verified on the server before a session is created. The destination is only ever a path on this site.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const failed = new URL(`${DEFAULT_DESTINATION}?auth=failed`, request.url);

  const next = searchParams.get("next");
  const destination = safeInternalPath(next, DEFAULT_DESTINATION);
  if (next !== null && destination !== next) {
    logger.warn("Blocked an unsafe redirect after sign-in", { event: "unsafe_redirect_blocked" });
  }

  if (!tokenHash || type !== "email") return NextResponse.redirect(failed);

  const client = await createSessionClient();
  if (!client) return NextResponse.redirect(failed);

  const { error } = await client.auth.verifyOtp({ type: "email", token_hash: tokenHash });
  if (error) {
    logger.info("Sign-in link was rejected", { event: "sign_in_link_rejected" });
    return NextResponse.redirect(failed);
  }

  const target = new URL(destination, request.url);
  // Defence in depth: whatever the path parsing did, the redirect must stay on this site.
  if (target.origin !== new URL(request.url).origin) {
    return NextResponse.redirect(new URL(DEFAULT_DESTINATION, request.url));
  }
  return NextResponse.redirect(target);
}
