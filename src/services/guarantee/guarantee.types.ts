/** A guarantee claim, after validation and sanitising. */
export interface GuaranteeClaim {
  reference: string;
  name: string;
  phone: string;
  email: string | null;
  details: string;
  submittedAt: string;
}

/** Delivers a claim to the owner. Resolves when the claim is delivered and rejects when it is not. */
export interface GuaranteeClaimNotifier {
  notifyOwner(claim: GuaranteeClaim): Promise<void>;
}
