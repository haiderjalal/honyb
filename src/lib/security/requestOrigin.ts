/**
 * Browsers send an Origin header on every cross-site POST, so an Origin that is not this site means another website is
 * making the request. A request with no Origin comes from a non-browser client, which cannot be a CSRF victim.
 */
export function isSameSiteOrigin(requestUrl: string, originHeader: string | null): boolean {
  if (originHeader === null) return true;
  try {
    return originHeader === new URL(requestUrl).origin;
  } catch {
    return false;
  }
}

/**
 * True when the body is declared as JSON. A form posted from another site cannot declare JSON without a preflight
 * request, which our API does not allow.
 */
export function isJsonContentType(contentType: string | null): boolean {
  const mediaType = contentType?.split(";")[0]?.trim().toLowerCase();
  return mediaType === "application/json";
}
