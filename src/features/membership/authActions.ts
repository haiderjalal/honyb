"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getClientIp, networkForLogs } from "@/lib/http/clientIp";
import { logger } from "@/lib/logger";
import { createRateLimiter } from "@/lib/rateLimit";
import { createSessionClient } from "@/lib/supabase/session";

import type { SignInState } from "./signInState";

const emailSchema = z.email();
// A few links per address and per window, so the form cannot be used to flood someone's inbox.
const limiter = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });
// The same limit per connection, so one visitor cannot cycle through addresses to flood inboxes.
const ipLimiter = createRateLimiter({ limit: 10, windowMs: 10 * 60 * 1000 });

/** Emails a one-time sign-in link. The email is sent through the project's configured mail provider. */
export async function requestSignInLink(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { status: "error", message: "Enter a valid email address." };

  const clientKey = getClientIp(await headers());
  const ipRate = ipLimiter.check(clientKey);
  if (!ipRate.allowed) {
    logger.warn("Sign-in links rate limited", {
      event: "rate_limited",
      route: "sign_in",
      network: networkForLogs(clientKey),
    });
    return {
      status: "error",
      message: "There have been a lot of requests from your connection. Please try again later.",
    };
  }

  const rate = limiter.check(email);
  if (!rate.allowed) {
    logger.warn("Sign-in link rate limited for an address", {
      event: "rate_limited",
      route: "sign_in_address",
      network: networkForLogs(clientKey),
    });
    return { status: "error", message: "We've sent a few links to this address recently. Please try again later." };
  }

  const client = await createSessionClient();
  if (!client) return { status: "error", message: "Member sign-in is not available yet." };

  const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) {
    logger.warn("Membership sign-in link failed", { error: error.message });
    return { status: "error", message: "We couldn't send a sign-in link just now. Please try again shortly." };
  }

  return { status: "sent", message: "Check your inbox for a sign-in link. It can take a minute to arrive." };
}

export async function signOutMember(): Promise<void> {
  const client = await createSessionClient();
  await client?.auth.signOut();
  redirect("/membership/account");
}
