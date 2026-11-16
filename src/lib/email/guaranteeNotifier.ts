import "server-only";

import { Resend } from "resend";

import { getServerEnv, type ServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { GuaranteeClaim, GuaranteeClaimNotifier } from "@/services/guarantee/guarantee.types";

import { guaranteeClaimEmail } from "./guaranteeTemplates";
import { sendEmailWithRetry } from "./notifiers";

class ResendGuaranteeClaimNotifier implements GuaranteeClaimNotifier {
  constructor(
    private readonly client: Resend,
    private readonly from: string,
    private readonly ownerEmail: string,
  ) {}

  notifyOwner(claim: GuaranteeClaim): Promise<void> {
    return sendEmailWithRetry(this.client, {
      idempotencyKey: `guarantee-${claim.reference}-${claim.submittedAt}`,
      from: this.from,
      to: this.ownerEmail,
      content: guaranteeClaimEmail(claim),
      replyTo: claim.email ?? undefined,
    });
  }
}

/** Development / e2e transport: logs the claim reference instead of sending email. */
class ConsoleGuaranteeClaimNotifier implements GuaranteeClaimNotifier {
  async notifyOwner(claim: GuaranteeClaim): Promise<void> {
    logger.info("[console email] guarantee claim", { reference: claim.reference });
  }
}

/** Production without email configured: claims fail visibly, so they are never silently lost. */
class UnconfiguredGuaranteeClaimNotifier implements GuaranteeClaimNotifier {
  async notifyOwner(): Promise<void> {
    throw new Error("Email is not configured: set RESEND_API_KEY, INQUIRY_FROM_EMAIL and INQUIRY_TO_EMAIL");
  }
}

export function createGuaranteeClaimNotifier(env: ServerEnv): GuaranteeClaimNotifier {
  if (env.RESEND_API_KEY && env.INQUIRY_FROM_EMAIL && env.INQUIRY_TO_EMAIL && env.EMAIL_TRANSPORT !== "console") {
    return new ResendGuaranteeClaimNotifier(
      new Resend(env.RESEND_API_KEY),
      env.INQUIRY_FROM_EMAIL,
      env.INQUIRY_TO_EMAIL,
    );
  }
  if (env.NODE_ENV === "production" && env.EMAIL_TRANSPORT !== "console") {
    logger.error("Guarantee claims cannot be emailed: email is not configured", {});
    return new UnconfiguredGuaranteeClaimNotifier();
  }
  return new ConsoleGuaranteeClaimNotifier();
}

let instance: GuaranteeClaimNotifier | null = null;

/** The claim notifier for this server. Built once, on first use, so environment problems surface then. */
export function getGuaranteeClaimNotifier(): GuaranteeClaimNotifier {
  instance ??= createGuaranteeClaimNotifier(getServerEnv());
  return instance;
}
