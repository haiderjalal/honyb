import { describe, expect, it, vi } from "vitest";

import { guaranteeClaimEmail } from "@/lib/email/guaranteeTemplates";
import { guaranteeClaimSchema } from "@/lib/validations/guaranteeClaim.schema";
import { submitGuaranteeClaim } from "@/services/guarantee/guarantee.service";
import type { GuaranteeClaim } from "@/services/guarantee/guarantee.types";

const validClaim = {
  orderReference: "HB-261114-Y07P",
  name: "Azeem Qureshi",
  phone: "03001234567",
  email: "",
  details: "Found a small white crystal in the jar.",
};

const errorFields = (input: unknown): string[] => {
  const result = guaranteeClaimSchema.safeParse(input);
  return result.success ? [] : [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
};

describe("guaranteeClaimSchema", () => {
  it("accepts a complete claim", () => {
    expect(errorFields(validClaim)).toEqual([]);
  });

  it("accepts a lowercase order reference, which is then saved in capitals", () => {
    expect(errorFields({ ...validClaim, orderReference: "hb-261114-y07p" })).toEqual([]);
  });

  it("refuses a reference that is not an order reference", () => {
    expect(errorFields({ ...validClaim, orderReference: "123" })).toEqual(["orderReference"]);
    expect(errorFields({ ...validClaim, orderReference: "HB-261114-Y07P; DROP" })).toEqual(["orderReference"]);
  });

  it("refuses a mobile number that is not Pakistani", () => {
    expect(errorFields({ ...validClaim, phone: "0421234567" })).toEqual(["phone"]);
  });

  it("asks for enough detail to act on", () => {
    expect(errorFields({ ...validClaim, details: "bad" })).toEqual(["details"]);
    expect(errorFields({ ...validClaim, details: "x".repeat(1001) })).toEqual(["details"]);
  });

  it("allows an empty email but refuses a malformed one", () => {
    expect(errorFields({ ...validClaim, email: "" })).toEqual([]);
    expect(errorFields({ ...validClaim, email: "not-an-email" })).toEqual(["email"]);
  });
});

describe("submitGuaranteeClaim", () => {
  const now = () => new Date("2026-11-16T10:00:00Z");

  it("sends the claim to the owner, normalised", async () => {
    const notifyOwner = vi.fn(async () => undefined);
    const result = await submitGuaranteeClaim(
      { ...validClaim, orderReference: "hb-261114-y07p", email: "Azeem@Example.com" },
      { notifier: { notifyOwner }, now },
    );

    expect(result).toEqual({ ok: true });
    expect(notifyOwner).toHaveBeenCalledWith({
      reference: "HB-261114-Y07P",
      name: "Azeem Qureshi",
      phone: "03001234567",
      email: "azeem@example.com",
      details: "Found a small white crystal in the jar.",
      submittedAt: "2026-11-16T10:00:00.000Z",
    });
  });

  it("tells the customer to try again when the owner cannot be reached", async () => {
    const notifyOwner = vi.fn(async () => {
      throw new Error("provider down");
    });
    const result = await submitGuaranteeClaim(validClaim, { notifier: { notifyOwner }, now });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("try again");
  });

  it("removes line breaks from the name, so a claim cannot add mail headers", async () => {
    const notifyOwner = vi.fn<(claim: GuaranteeClaim) => Promise<void>>(async () => undefined);
    await submitGuaranteeClaim(
      { ...validClaim, name: "Azeem\r\nBcc: someone@example.com" },
      { notifier: { notifyOwner }, now },
    );

    const sent = notifyOwner.mock.calls[0]?.[0];
    expect(sent?.name).toBeDefined();
    expect(sent?.name).not.toMatch(/[\r\n]/);
  });
});

describe("guaranteeClaimEmail", () => {
  const claim: GuaranteeClaim = {
    reference: "HB-261114-Y07P",
    name: "Azeem Qureshi",
    phone: "03001234567",
    email: null,
    details: "<script>alert(1)</script>",
    submittedAt: "2026-11-16T10:00:00.000Z",
  };

  it("puts the order reference and customer name in the subject", () => {
    expect(guaranteeClaimEmail(claim).subject).toBe("Honey guarantee claim HB-261114-Y07P — Azeem Qureshi");
  });

  it("escapes what the customer wrote before it reaches the owner's inbox", () => {
    const { html } = guaranteeClaimEmail(claim);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("reminds the team to ask for a photo or video and not to ask for the jar", () => {
    expect(guaranteeClaimEmail(claim).text).toContain("photo or video");
    expect(guaranteeClaimEmail(claim).text).toContain("The jar is not returned");
  });
});
