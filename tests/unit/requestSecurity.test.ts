import { describe, expect, it } from "vitest";

import { getClientIp, networkForLogs } from "@/lib/http/clientIp";
import { isJsonContentType, isSameSiteOrigin } from "@/lib/security/requestOrigin";
import { safeInternalPath } from "@/lib/security/safeRedirect";
import { hardenSessionCookie } from "@/lib/security/sessionCookie";

const REQUEST_URL = "https://honyb.example/api/inquiries";

describe("isSameSiteOrigin", () => {
  it("accepts the site's own origin", () => {
    expect(isSameSiteOrigin(REQUEST_URL, "https://honyb.example")).toBe(true);
  });

  it("accepts requests with no Origin header, which come from non-browser clients", () => {
    expect(isSameSiteOrigin(REQUEST_URL, null)).toBe(true);
  });

  it("refuses another site's origin", () => {
    expect(isSameSiteOrigin(REQUEST_URL, "https://evil.example")).toBe(false);
  });

  it("refuses a different scheme or port, which are different origins", () => {
    expect(isSameSiteOrigin(REQUEST_URL, "http://honyb.example")).toBe(false);
    expect(isSameSiteOrigin(REQUEST_URL, "https://honyb.example:8443")).toBe(false);
  });

  it("refuses the opaque 'null' origin sent by sandboxed frames and some redirects", () => {
    expect(isSameSiteOrigin(REQUEST_URL, "null")).toBe(false);
  });

  it("refuses an origin that is not a valid URL", () => {
    expect(isSameSiteOrigin("not a url", "https://honyb.example")).toBe(false);
  });
});

describe("isJsonContentType", () => {
  it("accepts JSON, with or without parameters, in any letter case", () => {
    expect(isJsonContentType("application/json")).toBe(true);
    expect(isJsonContentType("application/json; charset=utf-8")).toBe(true);
    expect(isJsonContentType("Application/JSON")).toBe(true);
  });

  it("refuses form and text bodies, which a cross-site form can send without a preflight", () => {
    expect(isJsonContentType("text/plain")).toBe(false);
    expect(isJsonContentType("application/x-www-form-urlencoded")).toBe(false);
    expect(isJsonContentType("multipart/form-data; boundary=x")).toBe(false);
    expect(isJsonContentType(null)).toBe(false);
  });
});

describe("safeInternalPath", () => {
  const FALLBACK = "/membership/account";

  it("keeps a path on this site, including its query string", () => {
    expect(safeInternalPath("/membership/account", FALLBACK)).toBe("/membership/account");
    expect(safeInternalPath("/membership/account?tab=renew", FALLBACK)).toBe("/membership/account?tab=renew");
  });

  it.each([
    ["no value", null],
    ["an empty value", ""],
    ["a relative path", "membership/account"],
    ["an absolute URL", "https://evil.example"],
    ["a protocol-relative path", "//evil.example"],
    ["a backslash trick browsers read as //host", "/\\evil.example"],
    ["an encoded double slash", "/%2F%2Fevil.example"],
    ["an encoded backslash", "/%5Cevil.example"],
    ["a line break", "/ok\r\nSet-Cookie: x=1"],
  ])("falls back for %s", (_label, value) => {
    expect(safeInternalPath(value, FALLBACK)).toBe(FALLBACK);
  });
});

describe("getClientIp", () => {
  it("prefers the platform-set real IP over the forwarded chain", () => {
    const headers = new Headers({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1, 10.0.0.1" });
    expect(getClientIp(headers)).toBe("203.0.113.7");
  });

  it("falls back to the first forwarded entry when no real IP is set", () => {
    const headers = new Headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" });
    expect(getClientIp(headers)).toBe("198.51.100.1");
  });

  it("uses a single shared key when no address is known", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});

describe("networkForLogs", () => {
  it("keeps the first three IPv4 octets, so the single address is not recorded", () => {
    expect(networkForLogs("203.0.113.7")).toBe("203.0.113.0/24");
    expect(networkForLogs("203.0.113.7")).not.toContain("7");
  });

  it("keeps the first three IPv6 groups", () => {
    expect(networkForLogs("2001:db8:85a3:0:0:8a2e:370:7334")).toBe("2001:db8:85a3::/48");
  });

  it("expands a shortened IPv6 address before taking its network, so loopback is labelled correctly", () => {
    expect(networkForLogs("::1")).toBe("0:0:0::/48");
    expect(networkForLogs("2001:db8::1")).toBe("2001:db8:0::/48");
  });

  it("does not guess when the address is missing or malformed", () => {
    expect(networkForLogs("unknown")).toBe("unknown");
    expect(networkForLogs("not an address")).toBe("unknown");
  });

  it("gives visitors on the same network the same label, so repeated abuse from one network is visible", () => {
    expect(networkForLogs("203.0.113.7")).toBe(networkForLogs("203.0.113.200"));
    expect(networkForLogs("203.0.113.7")).not.toBe(networkForLogs("203.0.114.7"));
  });
});

describe("hardenSessionCookie", () => {
  it("forces the safe flags in production, whatever the library asked for", () => {
    expect(hardenSessionCookie({ maxAge: 100, httpOnly: false, sameSite: "none", secure: false }, true)).toEqual({
      maxAge: 100,
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });
  });

  it("keeps the flags that can be used over plain HTTP during local development", () => {
    expect(hardenSessionCookie(undefined, false)).toEqual({
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    });
  });
});
