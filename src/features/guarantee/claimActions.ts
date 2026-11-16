"use server";

import { headers } from "next/headers";

import { getGuaranteeClaimNotifier } from "@/lib/email/guaranteeNotifier";
import { getClientIp, networkForLogs } from "@/lib/http/clientIp";
import { logger } from "@/lib/logger";
import { createRateLimiter } from "@/lib/rateLimit";
import { guaranteeClaimSchema } from "@/lib/validations/guaranteeClaim.schema";
import { submitGuaranteeClaim } from "@/services/guarantee/guarantee.service";
import type { GuaranteeClaimNotifier } from "@/services/guarantee/guarantee.types";

import { isGuaranteeClaimField, type GuaranteeClaimField, type GuaranteeClaimState } from "./claimState";

import type { ZodError } from "zod";

// Claims are rare, so a few per connection in ten minutes is plenty for a real customer.
const limiter = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

const SENT: GuaranteeClaimState = {
  status: "sent",
  message: "Thank you. We've received your claim and will contact you on the number you gave.",
  fieldErrors: {},
};

function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function fieldErrorsFrom(error: ZodError): GuaranteeClaimState["fieldErrors"] {
  const errors: GuaranteeClaimState["fieldErrors"] = {};
  for (const issue of error.issues) {
    const name = String(issue.path[0] ?? "");
    if (isGuaranteeClaimField(name)) errors[name as GuaranteeClaimField] ??= issue.message;
  }
  return errors;
}

/** Receives a guarantee claim from the claim form. Everything is checked on the server, whatever the form checked. */
export async function submitGuaranteeClaimAction(
  _previous: GuaranteeClaimState,
  formData: FormData,
): Promise<GuaranteeClaimState> {
  const clientKey = getClientIp(await headers());
  const network = networkForLogs(clientKey);

  // Real visitors never see or fill this field. A bot that fills it gets the same reply as a success, and nothing is sent.
  if (readField(formData, "website") !== "") {
    logger.warn("Guarantee claim honeypot triggered", { event: "honeypot_filled", route: "guarantee_claim", network });
    return SENT;
  }

  if (!limiter.check(clientKey).allowed) {
    logger.warn("Guarantee claims rate limited", { event: "rate_limited", route: "guarantee_claim", network });
    return {
      status: "error",
      message: "We've had a lot of claims from your connection. Please try again later.",
      fieldErrors: {},
    };
  }

  const parsed = guaranteeClaimSchema.safeParse({
    orderReference: readField(formData, "orderReference"),
    name: readField(formData, "name"),
    phone: readField(formData, "phone"),
    email: readField(formData, "email"),
    details: readField(formData, "details"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  let notifier: GuaranteeClaimNotifier;
  try {
    notifier = getGuaranteeClaimNotifier();
  } catch (error) {
    logger.error("Guarantee claim notifier could not be set up", { error });
    return {
      status: "error",
      message: "We couldn't send your claim just now. Please try again in a moment.",
      fieldErrors: {},
    };
  }

  const result = await submitGuaranteeClaim(parsed.data, { notifier });
  return result.ok ? SENT : { status: "error", message: result.message, fieldErrors: {} };
}
