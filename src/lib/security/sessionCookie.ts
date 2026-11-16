export interface SessionCookieOptions {
  path?: string;
  maxAge?: number;
  expires?: Date;
  domain?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none" | boolean;
}

/**
 * Session cookies are set with these flags explicitly, rather than trusting the library's defaults: page scripts cannot
 * read them, they are sent only over HTTPS in production, and they are not sent on cross-site requests.
 */
export function hardenSessionCookie(
  options: SessionCookieOptions | undefined,
  production: boolean,
): SessionCookieOptions {
  return { ...options, path: "/", httpOnly: true, secure: production, sameSite: "lax" };
}
