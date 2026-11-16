"use client";

import { LoaderCircle, Send } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/Button";
import { InputField, TextareaField } from "@/components/ui/Field";

import { submitGuaranteeClaimAction } from "../claimActions";
import { GUARANTEE_CLAIM_IDLE } from "../claimState";

import type { ReactElement } from "react";

/** The claim form. The server checks every field again, so this form only helps the customer fill it in. */
export function GuaranteeClaimForm(): ReactElement {
  const [state, formAction, isPending] = useActionState(submitGuaranteeClaimAction, GUARANTEE_CLAIM_IDLE);

  if (state.status === "sent") {
    return (
      <p role="status" className="rounded-xl border border-gold-400/40 px-4 py-3 text-cream-100">
        {state.message}
      </p>
    );
  }

  const errors = state.fieldErrors;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <InputField
        id="claim-order-reference"
        name="orderReference"
        label="Order reference"
        placeholder="HB-261114-Y07P"
        hint="It is on your order confirmation, and it starts with HB-."
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        error={errors.orderReference}
        required
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <InputField id="claim-name" name="name" label="Full name" autoComplete="name" error={errors.name} required />
        <InputField
          id="claim-phone"
          name="phone"
          label="Mobile number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0300 1234567"
          hint="We'll call or WhatsApp this number."
          error={errors.phone}
          required
        />
      </div>
      <InputField
        id="claim-email"
        name="email"
        label="Email"
        optional
        type="email"
        autoComplete="email"
        autoCapitalize="off"
        spellCheck={false}
        error={errors.email}
      />
      <TextareaField
        id="claim-details"
        name="details"
        label="What is wrong with the honey?"
        hint="Describe what you found. Then send a photo or video of it on WhatsApp, or by email, quoting your order reference."
        rows={4}
        maxLength={1000}
        error={errors.details}
        required
      />

      {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
      <div aria-hidden="true" className="visually-hidden">
        <label htmlFor="claim-website">Website</label>
        <input id="claim-website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      {state.status === "error" && state.message ? (
        <p role="alert" className="rounded-xl border border-danger/60 px-4 py-3 text-sm text-danger">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="size-4" aria-hidden="true" />
        )}
        {isPending ? "Sending your claim" : "Send my claim"}
      </Button>
    </form>
  );
}
