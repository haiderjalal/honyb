/**
 * The honey guarantee. The guarantee page, the product and checkout notes, and the claim form all read these values,
 * so the promise is stated the same way everywhere. Change them only when the business changes the promise.
 */
export const HONEY_GUARANTEE = {
  /** A claim must be made within this many days of delivery. */
  claimWindowDays: 30,
} as const;
