const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
/** Encoded slashes and backslashes are refused too, because some browsers and proxies decode them into "//host". */
const ENCODED_SEPARATORS = /%(2f|5c)/i;

/**
 * Returns `value` only when it is a path on this site. Absolute URLs, protocol-relative paths such as //host, and
 * backslash tricks such as /\host all fall back to `fallback`, so a sign-in link can never send a visitor elsewhere.
 */
export function safeInternalPath(value: string | null, fallback: string): string {
  if (!value || !value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.includes("\\")) return fallback;
  if (CONTROL_CHARACTERS.test(value) || ENCODED_SEPARATORS.test(value)) return fallback;
  return value;
}
