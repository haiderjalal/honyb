import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ ip: "203.0.113.50" }));
const notifyOwner = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": state.ip }),
}));

vi.mock("@/lib/email/guaranteeNotifier", () => ({
  getGuaranteeClaimNotifier: () => ({ notifyOwner }),
}));

import { submitGuaranteeClaimAction } from "@/features/guarantee/claimActions";
import { GUARANTEE_CLAIM_IDLE, type GuaranteeClaimState } from "@/features/guarantee/claimState";

const validFields = {
  orderReference: "HB-261114-Y07P",
  name: "Azeem Qureshi",
  phone: "03001234567",
  email: "",
  details: "Found a small white crystal in the jar.",
  website: "",
};

function claimForm(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return form;
}

function submit(fields: Record<string, string>): Promise<GuaranteeClaimState> {
  return submitGuaranteeClaimAction(GUARANTEE_CLAIM_IDLE, claimForm(fields));
}

describe("submitGuaranteeClaimAction", () => {
  beforeEach(() => {
    notifyOwner.mockReset();
    notifyOwner.mockResolvedValue(undefined);
  });

  it("sends a valid claim to the owner and confirms it to the customer", async () => {
    state.ip = "198.51.100.1";

    const result = await submit(validFields);

    expect(result.status).toBe("sent");
    expect(notifyOwner).toHaveBeenCalledTimes(1);
  });

  it("tells a bot that filled the hidden field it was sent, but sends nothing", async () => {
    state.ip = "198.51.100.2";

    const result = await submit({ ...validFields, website: "http://spam.example" });

    expect(result.status).toBe("sent");
    expect(notifyOwner).not.toHaveBeenCalled();
  });

  it("returns field errors and sends nothing when a field is wrong", async () => {
    state.ip = "198.51.100.3";

    const result = await submit({ ...validFields, phone: "0421234567", orderReference: "nope" });

    expect(result.status).toBe("error");
    expect(result.fieldErrors.phone).toBeTruthy();
    expect(result.fieldErrors.orderReference).toBeTruthy();
    expect(notifyOwner).not.toHaveBeenCalled();
  });

  it("refuses a sixth claim from the same connection within ten minutes", async () => {
    state.ip = "198.51.100.4";

    for (let index = 0; index < 5; index += 1) {
      expect((await submit(validFields)).status).toBe("sent");
    }

    const blocked = await submit(validFields);
    expect(blocked.status).toBe("error");
    expect(blocked.message).toContain("a lot of claims");
    expect(notifyOwner).toHaveBeenCalledTimes(5);
  });
});
