import { logger } from "@/lib/logger";
import { normalizePhone, sanitizeLine, sanitizeMultiline } from "@/utils/text";

import type { GuaranteeClaim, GuaranteeClaimNotifier } from "./guarantee.types";

export interface GuaranteeClaimInput {
  orderReference: string;
  name: string;
  phone: string;
  email?: string;
  details: string;
}

export type GuaranteeClaimResult = { ok: true } | { ok: false; message: string };

interface SubmitDependencies {
  notifier: GuaranteeClaimNotifier;
  now?: () => Date;
}

const DELIVERY_FAILED = "We couldn't send your claim just now. Please try again in a moment.";

/**
 * Passes a guarantee claim on to the owner. The input has already been validated; this step only normalises and
 * sanitises it. A failure is logged with the order reference, and the customer is asked to try again.
 */
export async function submitGuaranteeClaim(
  input: GuaranteeClaimInput,
  { notifier, now = () => new Date() }: SubmitDependencies,
): Promise<GuaranteeClaimResult> {
  const email = input.email ? sanitizeLine(input.email).toLowerCase() : "";
  const claim: GuaranteeClaim = {
    reference: input.orderReference.trim().toUpperCase(),
    name: sanitizeLine(input.name),
    phone: normalizePhone(input.phone),
    email: email || null,
    details: sanitizeMultiline(input.details),
    submittedAt: now().toISOString(),
  };

  try {
    await notifier.notifyOwner(claim);
  } catch (error) {
    logger.error("Guarantee claim could not be sent to the owner", { reference: claim.reference, error });
    return { ok: false, message: DELIVERY_FAILED };
  }

  logger.info("Guarantee claim received", { reference: claim.reference });
  return { ok: true };
}
