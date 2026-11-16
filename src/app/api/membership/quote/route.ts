import { NextResponse } from "next/server";
import { z } from "zod";

import { getClientIp, networkForLogs } from "@/lib/http/clientIp";
import { readBodyWithLimit } from "@/lib/http/readBodyWithLimit";
import { logger } from "@/lib/logger";
import { createRateLimiter } from "@/lib/rateLimit";
import { isJsonContentType, isSameSiteOrigin } from "@/lib/security/requestOrigin";
import { cartItemsSchema } from "@/lib/validations/inquiry.schema";
import { getMembershipRepository } from "@/lib/supabase/membershipRepository";
import { getSignedInUser } from "@/lib/supabase/session";
import { getListPrice, getPricedVariant } from "@/services/catalog.service";
import {
  quoteMemberDiscount,
  type MemberQuote,
  type OrderDiscountLine,
} from "@/services/membership/membership.service";
import { rupeesToMinor } from "@/utils/money";

import type { ApiResponse } from "@/types/api";

const quoteSchema = z.object({
  items: cartItemsSchema,
});

const NO_STORE = { "Cache-Control": "no-store" };
// A basket of 15 lines is well under 4 KB, so anything larger is not a real basket.
const MAX_BODY_BYTES = 4 * 1024;

function parseJsonOrNull(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
// Every quote costs a database call for a signed-in member, so one visitor's repeated requests are capped.
const limiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000 });

/** Prices the basket from the catalogue, merging repeated jars. Returns null for any unknown product. */
function priceBasket(items: z.infer<typeof quoteSchema>["items"]): OrderDiscountLine[] | null {
  const merged = new Map<string, OrderDiscountLine>();
  for (const item of items) {
    const variant = getPricedVariant(item.varietySlug, item.sizeId);
    if (!variant) return null;

    const lineKey = `${item.varietySlug}:${item.sizeId}`;
    const quantity = (merged.get(lineKey)?.quantity ?? 0) + item.quantity;
    merged.set(lineKey, {
      lineKey,
      quantity,
      lineTotalMinor: rupeesToMinor(variant.unitPrice) * quantity,
      onSale: getListPrice(variant.variety, variant.size.id) !== null,
    });
  }
  return [...merged.values()];
}

/**
 * POST /api/membership/quote — the member discount for a basket, for display only. It never reserves an allowance,
 * and a signed-out visitor simply gets { signedIn: false }. Requests must come from this site, as JSON.
 */
export async function POST(request: Request): Promise<NextResponse<ApiResponse<MemberQuote>>> {
  const clientKey = getClientIp(request.headers);
  const network = networkForLogs(clientKey);

  if (!isSameSiteOrigin(request.url, request.headers.get("origin"))) {
    logger.warn("Blocked a cross-site quote request", {
      event: "csrf_origin_rejected",
      route: "membership_quote",
      network,
    });
    return NextResponse.json(
      { success: false, message: "We couldn't verify this request. Please refresh the page and try again." },
      { status: 403, headers: NO_STORE },
    );
  }

  if (!isJsonContentType(request.headers.get("content-type"))) {
    return NextResponse.json(
      { success: false, message: "Check your hive and try again." },
      { status: 415, headers: NO_STORE },
    );
  }

  const rate = limiter.check(clientKey);
  if (!rate.allowed) {
    logger.warn("Member discount quotes rate limited", { event: "rate_limited", route: "membership_quote", network });
    return NextResponse.json(
      { success: false, message: "Too many requests. Please wait a minute and try again." },
      {
        status: 429,
        headers: { ...NO_STORE, "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) },
      },
    );
  }

  const repo = getMembershipRepository();
  const user = repo ? await getSignedInUser().catch(() => null) : null;
  if (!repo || !user) {
    return NextResponse.json({ success: true, message: "", data: { signedIn: false } }, { headers: NO_STORE });
  }

  const raw = await readBodyWithLimit(request, MAX_BODY_BYTES);
  if (raw === null) {
    return NextResponse.json(
      { success: false, message: "Your request is too large." },
      { status: 413, headers: NO_STORE },
    );
  }

  const parsed = quoteSchema.safeParse(parseJsonOrNull(raw));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Check your hive and try again." },
      { status: 422, headers: NO_STORE },
    );
  }

  const lines = priceBasket(parsed.data.items);
  if (!lines) {
    return NextResponse.json(
      { success: false, message: "Some jars in your hive are no longer available." },
      { status: 422, headers: NO_STORE },
    );
  }

  try {
    const quote = await quoteMemberDiscount(repo, { customerUserId: user.id, lines, now: new Date() });
    return NextResponse.json({ success: true, message: "", data: quote }, { headers: NO_STORE });
  } catch (error) {
    logger.error("Member discount quote failed", { error });
    return NextResponse.json(
      { success: false, message: "We couldn't check your member discount just now." },
      { status: 500, headers: NO_STORE },
    );
  }
}
