import Link from "next/link";

import { HONEY_GUARANTEE } from "@/constants/guarantee";
import { ROUTES } from "@/constants/routes";

import type { ReactElement } from "react";

/** The one-line promise shown on product pages and at checkout, linking to the full guarantee. */
export function HoneyGuaranteeNote(): ReactElement {
  return (
    <p className="rounded-xl border border-gold-400/30 bg-gold-400/5 px-4 py-3 text-sm leading-relaxed text-cream-100">
      <span className="font-semibold text-gold-300">Honey guarantee.</span> If anything is wrong with your honey, we
      refund everything you paid, delivery included. Claim within {HONEY_GUARANTEE.claimWindowDays} days of delivery.{" "}
      <Link href={ROUTES.guarantee} className="underline underline-offset-4 hover:text-gold-300">
        Read the guarantee
      </Link>
    </p>
  );
}
