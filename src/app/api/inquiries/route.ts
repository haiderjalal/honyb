import { after, NextResponse } from "next/server";

import { getClientIp, networkForLogs } from "@/lib/http/clientIp";
import { readBodyWithLimit } from "@/lib/http/readBodyWithLimit";
import { logger } from "@/lib/logger";
import { createRateLimiter } from "@/lib/rateLimit";
import { isJsonContentType, isSameSiteOrigin } from "@/lib/security/requestOrigin";
import { getSignedInUser } from "@/lib/supabase/session";
import { inquirySchema } from "@/lib/validations/inquiry.schema";
import { getInquiryService } from "@/services/inquiry.factory";

import type { ApiResponse, FieldErrors, InquiryReceipt } from "@/types/api";

const MAX_BODY_BYTES = 16 * 1024;
const limiter = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

/** Email retries can take close to 20 s in the worst case; allow headroom so a send is never cut off. */
export const maxDuration = 30;

type InquiryResponse = NextResponse<ApiResponse<InquiryReceipt>>;

const fail = (status: number, message: string, errors?: FieldErrors, headers?: HeadersInit): InquiryResponse =>
  NextResponse.json({ success: false, message, errors }, { status, headers });

/**
 * POST /api/inquiries — validates an order request and hands it to the InquiryService.
 * Requests must come from this site and be sent as JSON. Suspicious requests are logged with a hashed IP.
 */
export async function POST(request: Request): Promise<InquiryResponse> {
  const clientKey = getClientIp(request.headers);
  const network = networkForLogs(clientKey);

  if (!isSameSiteOrigin(request.url, request.headers.get("origin"))) {
    logger.warn("Blocked a cross-site order request", { event: "csrf_origin_rejected", route: "inquiries", network });
    return fail(403, "We couldn't verify this request. Please refresh the page and try again.");
  }

  if (!isJsonContentType(request.headers.get("content-type"))) {
    logger.warn("Order request was not sent as JSON", {
      event: "unexpected_content_type",
      route: "inquiries",
      network,
    });
    return fail(415, "We couldn't read your request. Please try again.");
  }

  const rate = limiter.check(clientKey);
  if (!rate.allowed) {
    logger.warn("Order requests rate limited", { event: "rate_limited", route: "inquiries", network });
    return fail(429, "Too many requests. Please wait a few minutes and try again.", undefined, {
      "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)),
    });
  }

  const raw = await readBodyWithLimit(request, MAX_BODY_BYTES);
  if (raw === null) {
    logger.warn("Oversized order request blocked", { event: "oversized_body", route: "inquiries", network });
    return fail(413, "Your request is too large.");
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    logger.warn("Malformed order request", { event: "malformed_body", route: "inquiries", network });
    return fail(400, "We couldn't read your request. Please try again.");
  }

  const parsed = inquirySchema.safeParse(body);
  if (!parsed.success) {
    const errors: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      errors[field] ??= issue.message;
    }
    logger.info("Inquiry validation failed", { fields: Object.keys(errors) });
    return fail(422, "Please check the highlighted fields.", errors);
  }

  // Honeypot filled: pretend success so bots learn nothing.
  if (parsed.data.website) {
    logger.warn("Inquiry honeypot triggered", { event: "honeypot_filled", route: "inquiries", network });
    return NextResponse.json({
      success: true,
      message: "Thank you! We'll be in touch shortly.",
      data: { reference: "HB-RECEIVED" },
    });
  }

  try {
    // A signed-in member may get their discount. Anyone else, or a failed session check, orders at regular prices.
    const customerUserId = await getSignedInUser()
      .then((user) => user?.id ?? null)
      .catch(() => null);
    const result = await getInquiryService().submit(parsed.data, { defer: after, customerUserId });
    if (!result.ok) return fail(result.reason === "invalid_items" ? 422 : 502, result.message);

    return NextResponse.json(
      {
        success: true,
        message: "Thank you! We'll call you shortly to confirm your order.",
        data: { reference: result.reference },
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error("Unexpected inquiry error", { error });
    return fail(500, "Something went wrong on our side. Please try again.");
  }
}
