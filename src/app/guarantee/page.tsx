import type { Metadata } from "next";
import Link from "next/link";
import type { JSX } from "react";

import { Container } from "@/components/layout/Container";
import { HONEY_GUARANTEE } from "@/constants/guarantee";
import { ROUTES } from "@/constants/routes";
import { whatsappUrl } from "@/constants/site";

const TITLE = "Honey guarantee";
const DESCRIPTION = `If anything is wrong with your honey, we refund everything you paid, delivery included. Claim within ${HONEY_GUARANTEE.claimWindowDays} days of delivery.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: ROUTES.guarantee },
  openGraph: { type: "website", url: ROUTES.guarantee, title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const CLAIM_STEPS = [
  "Send a photo or video that shows the problem.",
  "Include your order reference. It starts with HB- and is on your order confirmation.",
  "Send it on WhatsApp, or use the claim form. We do not ask you to return the jar.",
];

export default function GuaranteePage(): JSX.Element {
  const whatsapp = whatsappUrl("Hi HonyB, I'd like to make a honey guarantee claim.");

  return (
    <Container className="flex max-w-3xl flex-col gap-12 pt-32 pb-20">
      <header className="flex flex-col gap-4">
        <p className="text-xs font-semibold tracking-[0.3em] text-gold-400 uppercase">The HonyB promise</p>
        <h1 className="font-display text-4xl leading-tight text-cream-50 sm:text-5xl">Our honey guarantee</h1>
        <p className="text-cream-200 text-lg">
          If anything is wrong with your honey, we refund everything you paid, delivery included.
        </p>
      </header>

      <section aria-labelledby="covers" className="flex flex-col gap-3">
        <h2 id="covers" className="font-display text-2xl text-cream-50">
          What it covers
        </h2>
        <p className="text-cream-300">
          Any honey you buy from us. If something is wrong with the honey itself, including anything in the jar that
          should not be there, the guarantee applies.
        </p>
      </section>

      <section aria-labelledby="window" className="flex flex-col gap-3">
        <h2 id="window" className="font-display text-2xl text-cream-50">
          How long you have
        </h2>
        <p className="text-cream-300">You can claim within {HONEY_GUARANTEE.claimWindowDays} days of delivery.</p>
      </section>

      <section aria-labelledby="claim" className="flex flex-col gap-3">
        <h2 id="claim" className="font-display text-2xl text-cream-50">
          How to claim
        </h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-cream-300">
          {CLAIM_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href={ROUTES.guaranteeClaim}
            className="inline-flex min-h-12 items-center rounded-full bg-gold-400 px-6 font-medium text-forest-950 hover:bg-gold-300"
          >
            Make a claim
          </Link>
          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center rounded-full border border-cream-50/20 px-6 text-cream-100 hover:border-gold-300 hover:text-gold-300"
            >
              Message us on WhatsApp
            </a>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="refund" className="flex flex-col gap-3">
        <h2 id="refund" className="font-display text-2xl text-cream-50">
          What you get back
        </h2>
        <p className="text-cream-300">
          We refund the full amount you paid for the order, including delivery. We agree the refund method with you when
          we approve the claim.
        </p>
      </section>

      <section aria-labelledby="next" className="flex flex-col gap-3">
        <h2 id="next" className="font-display text-2xl text-cream-50">
          What happens next
        </h2>
        <p className="text-cream-300">
          We review each claim and contact you on the number you gave. If we need more information, we will ask you for
          it.
        </p>
      </section>
    </Container>
  );
}
