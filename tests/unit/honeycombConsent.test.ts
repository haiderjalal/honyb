// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CustomerOrderRepository } from "@/services/customerOrder.repository";

import { createMembershipTestDatabase, type MembershipTestDatabase } from "../fakes/membershipDatabase";

const DATABASE_HOOK_TIMEOUT_MS = 60_000;

let db: MembershipTestDatabase;
let repo: CustomerOrderRepository;

beforeAll(async () => {
  db = await createMembershipTestDatabase();
  repo = new CustomerOrderRepository(db.rpc);
}, DATABASE_HOOK_TIMEOUT_MS);

afterAll(async () => {
  await db.close();
}, DATABASE_HOOK_TIMEOUT_MS);

function order(reference: string, customerName: string, showOnHoneycomb?: boolean) {
  return {
    reference,
    customerName,
    phone: "03001234567",
    email: null,
    city: "Lahore",
    address: "House 12, Model Town",
    referral: null,
    notes: null,
    showOnHoneycomb,
    subtotalMinor: 100_000,
    membershipDiscountMinor: 0,
    totalMinor: 100_000,
    createdAt: new Date("2026-11-16T10:00:00Z"),
    items: [
      {
        lineKey: "sidr-honey:1kg",
        name: "Sidr Honey",
        sizeLabel: "1 kg",
        quantity: 1,
        unitPriceMinor: 100_000,
        lineTotalMinor: 100_000,
      },
    ],
  };
}

describe("honeycomb consent at checkout", () => {
  it("shows an order straight away when the customer ticked the box", async () => {
    await repo.insert(order("HB-CONS-0001", "Azeem Qureshi", true));

    const names = (await repo.honeycombEntries(200)).map((entry) => entry.customerName);
    expect(names).toEqual(["Azeem Qureshi"]);
  });

  it("keeps an order off the honeycomb when the box was not ticked", async () => {
    await repo.insert(order("HB-CONS-0002", "Saba Anjum Babar", false));
    await repo.insert(order("HB-CONS-0003", "Faizan Khan"));

    const names = (await repo.honeycombEntries(200)).map((entry) => entry.customerName);
    expect(names).toEqual(["Azeem Qureshi"]);
  });

  it("records when a customer agreed, and nothing when they did not", async () => {
    const [agreed] = await db.query<{ consent: string | null; show: boolean }>(
      "select honeycomb_consent_at as consent, show_on_honeycomb as show from customer_orders where reference = 'HB-CONS-0001'",
    );
    const [notAgreed] = await db.query<{ consent: string | null; show: boolean }>(
      "select honeycomb_consent_at as consent, show_on_honeycomb as show from customer_orders where reference = 'HB-CONS-0002'",
    );

    expect(agreed.show).toBe(true);
    expect(agreed.consent).not.toBeNull();
    expect(notAgreed.show).toBe(false);
    expect(notAgreed.consent).toBeNull();
  });

  it("does not change an order's visibility when the same order is submitted again", async () => {
    await repo.insert(order("HB-CONS-0001", "Azeem Qureshi", false));

    const names = (await repo.honeycombEntries(200)).map((entry) => entry.customerName);
    expect(names).toEqual(["Azeem Qureshi"]);
  });

  it("still lets an admin take a consenting customer off the honeycomb", async () => {
    await repo.setHoneycomb({
      reference: "HB-CONS-0001",
      show: false,
      actor: "admin@honeyb.test",
      reason: "Customer asked to be removed",
    });

    expect((await repo.honeycombEntries(200)).map((entry) => entry.customerName)).toEqual([]);
  });
});
