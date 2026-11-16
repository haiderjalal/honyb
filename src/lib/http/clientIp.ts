/**
 * The visitor's IP address, used as the rate-limit key. The platform-set real IP is preferred. The first
 * X-Forwarded-For entry can be supplied by the visitor, so it is only a fallback.
 */
export function getClientIp(headers: Headers): string {
  const realIp = headers.get("x-real-ip")?.trim();
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return realIp || forwarded || "unknown";
}

/**
 * The first `count` groups of an IPv6 address, with a "::" shortcut expanded so that loopback and other shortened
 * addresses still give the right network. Returns null when the address does not parse.
 */
function leadingIpv6Groups(ip: string, count: number): string[] | null {
  const halves = ip.split("::");
  if (halves.length > 2) return null;

  const head = halves[0] ? halves[0].split(":") : [];
  if (halves.length === 1) return head.length === 8 ? head.slice(0, count) : null;

  const tail = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0) return null;

  const groups = [...head, ...Array<string>(missing).fill("0"), ...tail];
  return groups.slice(0, count);
}

/**
 * The network an address belongs to, written into logs in place of the address. IPv4 keeps the first three octets and
 * IPv6 keeps the first three groups, so logs show abuse from one network without recording a single visitor's address.
 * A hash is not used because the IPv4 space is small enough to reverse by counting.
 */
export function networkForLogs(ip: string): string {
  if (ip.includes(":")) {
    const groups = leadingIpv6Groups(ip, 3);
    return groups ? `${groups.join(":")}::/48` : "unknown";
  }
  const octets = ip.split(".");
  if (octets.length === 4 && octets.every((octet) => /^\d{1,3}$/.test(octet))) {
    return `${octets.slice(0, 3).join(".")}.0/24`;
  }
  return "unknown";
}
