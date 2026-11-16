import { describe, expect, it } from "vitest";

import { refusesAdminRequest } from "@/lib/security/adminGate";

const SESSION = "sb-abcdefghijklmnop-auth-token";

describe("refusesAdminRequest", () => {
  it("refuses admin pages for a visitor with no session", () => {
    expect(refusesAdminRequest("/admin/orders", [])).toBe(true);
    expect(refusesAdminRequest("/admin/membership", ["cart"])).toBe(true);
    expect(refusesAdminRequest("/admin", [])).toBe(true);
  });

  it("lets a visitor with a Supabase session through to the admin role check", () => {
    expect(refusesAdminRequest("/admin/orders", [SESSION])).toBe(false);
  });

  it("recognises a session stored in numbered chunks", () => {
    expect(refusesAdminRequest("/admin/orders", [`${SESSION}.0`, `${SESSION}.1`])).toBe(false);
  });

  it("does not mistake other cookies for a session", () => {
    expect(refusesAdminRequest("/admin/orders", ["sb-abcdefghijklmnop-other", "auth-token"])).toBe(true);
  });

  it("leaves public pages alone, including paths that only start with the same letters", () => {
    expect(refusesAdminRequest("/checkout", [])).toBe(false);
    expect(refusesAdminRequest("/administrator", [])).toBe(false);
    expect(refusesAdminRequest("/", [])).toBe(false);
  });
});
