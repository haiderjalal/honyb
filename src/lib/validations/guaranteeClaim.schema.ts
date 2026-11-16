import { z } from "zod";

import { normalizePhone } from "@/utils/text";

import { PK_MOBILE_PATTERN } from "./inquiry.schema";

/** A guarantee claim as submitted from the claim form. Checked on the server, whatever the browser checked. */
export const guaranteeClaimSchema = z.object({
  orderReference: z
    .string()
    .trim()
    .regex(/^HB-[A-Z0-9-]{4,40}$/i, "Enter the order reference from your confirmation, such as HB-261114-Y07P."),
  name: z.string().trim().min(2, "Please enter your name.").max(80, "Please keep your name under 80 characters."),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => PK_MOBILE_PATTERN.test(normalizePhone(value)),
      "Please enter a valid mobile number, e.g. 0300 1234567.",
    ),
  email: z.union([z.literal(""), z.email("Please enter a valid email address.").max(120)]).optional(),
  details: z
    .string()
    .trim()
    .min(10, "Tell us what is wrong with the honey, in at least 10 characters.")
    .max(1000, "Please keep it under 1000 characters."),
});

export type GuaranteeClaimFormInput = z.infer<typeof guaranteeClaimSchema>;
