import type { Metadata } from "next";
import Link from "next/link";
import type { JSX } from "react";

import { Container } from "@/components/layout/Container";
import { ROUTES } from "@/constants/routes";
import { GuaranteeClaimForm } from "@/features/guarantee/components/GuaranteeClaimForm";

const TITLE = "Make a honey guarantee claim";
const DESCRIPTION = "Tell us what is wrong with your honey, and we will contact you about your claim.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: ROUTES.guaranteeClaim },
  openGraph: { type: "website", url: ROUTES.guaranteeClaim, title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function GuaranteeClaimPage(): JSX.Element {
  return (
    <Container className="flex max-w-2xl flex-col gap-10 pt-32 pb-20">
      <header className="flex flex-col gap-4">
        <p className="text-xs font-semibold tracking-[0.3em] text-gold-400 uppercase">Honey guarantee</p>
        <h1 className="font-display text-4xl leading-tight text-cream-50 sm:text-5xl">Make a claim</h1>
        <p className="text-cream-300">
          Fill in the form, then send a photo or video of the problem, quoting your order reference. Read the{" "}
          <Link href={ROUTES.guarantee} className="underline underline-offset-4 hover:text-gold-300">
            guarantee terms
          </Link>{" "}
          first.
        </p>
      </header>
      <GuaranteeClaimForm />
    </Container>
  );
}
