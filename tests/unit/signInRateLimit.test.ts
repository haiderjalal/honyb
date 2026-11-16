import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ ip: "203.0.113.1" }));
const signInWithOtp = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": state.ip }),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

vi.mock("@/lib/supabase/session", () => ({
  createSessionClient: async () => ({ auth: { signInWithOtp } }),
}));

import { requestSignInLink } from "@/features/membership/authActions";

const IDLE = { status: "idle" } as const;

function signIn(email: string): ReturnType<typeof requestSignInLink> {
  const form = new FormData();
  form.set("email", email);
  return requestSignInLink(IDLE as Parameters<typeof requestSignInLink>[0], form);
}

describe("requestSignInLink rate limits", () => {
  beforeEach(() => {
    signInWithOtp.mockReset();
    signInWithOtp.mockResolvedValue({ error: null });
  });

  it("stops one connection after ten sign-in links, even when it uses different addresses", async () => {
    state.ip = "198.51.100.10";

    for (let index = 0; index < 10; index += 1) {
      expect((await signIn(`member${index}@example.com`)).status).toBe("sent");
    }

    const blocked = await signIn("member-eleven@example.com");
    expect(blocked.status).toBe("error");
    expect(blocked.message).toContain("a lot of requests from your connection");
    expect(signInWithOtp).toHaveBeenCalledTimes(10);
  });

  it("limits repeated links to one address to five", async () => {
    state.ip = "198.51.100.20";

    for (let index = 0; index < 5; index += 1) {
      expect((await signIn("repeat@example.com")).status).toBe("sent");
    }

    const blocked = await signIn("repeat@example.com");
    expect(blocked.status).toBe("error");
    expect(blocked.message).toContain("sent a few links to this address");
  });

  it("rejects an invalid address before any limit is used", async () => {
    state.ip = "198.51.100.30";
    const result = await signIn("not-an-email");
    expect(result.status).toBe("error");
    expect(signInWithOtp).not.toHaveBeenCalled();
  });
});
