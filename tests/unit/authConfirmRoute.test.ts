import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifyOtp } = vi.hoisted(() => ({ verifyOtp: vi.fn() }));

vi.mock("@/lib/supabase/session", () => ({
  createSessionClient: async () => ({ auth: { verifyOtp } }),
}));

import { GET } from "@/app/auth/confirm/route";

const SITE = "https://honyb.example";

async function confirm(next?: string): Promise<string | null> {
  const url = new URL(`${SITE}/auth/confirm`);
  url.searchParams.set("token_hash", "token-123");
  url.searchParams.set("type", "email");
  if (next !== undefined) url.searchParams.set("next", next);
  const response = await GET(new NextRequest(url));
  return response.headers.get("location");
}

describe("GET /auth/confirm", () => {
  beforeEach(() => {
    verifyOtp.mockReset();
    verifyOtp.mockResolvedValue({ error: null });
  });

  it("sends a verified visitor to the account page by default", async () => {
    expect(await confirm()).toBe(`${SITE}/membership/account`);
  });

  it("keeps a safe path on this site, including its query string", async () => {
    expect(await confirm("/membership/account?tab=renew")).toBe(`${SITE}/membership/account?tab=renew`);
  });

  it.each([
    ["a protocol-relative URL", "//evil.example"],
    ["a backslash trick", "/\\evil.example"],
    ["an absolute URL", "https://evil.example"],
    ["an encoded backslash", "/%5Cevil.example"],
  ])("ignores %s and uses the account page instead", async (_label, next) => {
    expect(await confirm(next)).toBe(`${SITE}/membership/account`);
  });

  it("sends a visitor with a rejected link to the failure message, not the requested path", async () => {
    verifyOtp.mockResolvedValueOnce({ error: { message: "Token has expired" } });
    expect(await confirm("/membership/account")).toBe(`${SITE}/membership/account?auth=failed`);
  });

  it("does not verify a request that lacks the token or the email type", async () => {
    const response = await GET(new NextRequest(`${SITE}/auth/confirm?type=email`));
    expect(response.headers.get("location")).toBe(`${SITE}/membership/account?auth=failed`);
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});
