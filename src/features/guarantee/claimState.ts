/** The fields of the claim form that can show an error. */
export const GUARANTEE_CLAIM_FIELDS = ["orderReference", "name", "phone", "email", "details"] as const;

export type GuaranteeClaimField = (typeof GUARANTEE_CLAIM_FIELDS)[number];

export interface GuaranteeClaimState {
  status: "idle" | "sent" | "error";
  message: string;
  fieldErrors: Partial<Record<GuaranteeClaimField, string>>;
}

export const GUARANTEE_CLAIM_IDLE: GuaranteeClaimState = { status: "idle", message: "", fieldErrors: {} };

export function isGuaranteeClaimField(value: string): value is GuaranteeClaimField {
  return (GUARANTEE_CLAIM_FIELDS as readonly string[]).includes(value);
}
