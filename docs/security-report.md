# Security review and hardening report

Date: 2026-11-16. Branch: `feature/honey-hive-membership`. These changes are uncommitted.

No application is unhackable. This review covers the code in this repository, the migrations, and the local behaviour of the running app, and it included an independent read-only review of the changes. It is not a penetration test. Items marked **Needs you** require a login to a dashboard I cannot reach, or a decision about the product.

## What was fixed

| # | Issue | Fix | Where |
|---|---|---|---|
| 1 | Sign-in redirect could send a visitor to another site (`/\host` and `//host` passed the old check) | Path allow-list with backslash, double-slash, encoded-separator and control-character checks, plus a same-origin guard | `src/lib/security/safeRedirect.ts`, `src/app/auth/confirm/route.ts` |
| 2 | Another website could submit orders on a visitor's behalf | Origin must match this site, and the body must be JSON | `src/lib/security/requestOrigin.ts`, `src/app/api/inquiries/route.ts` |
| 3 | Member discount quote could be called without limit | 30 requests per minute per visitor, plus origin and JSON checks | `src/app/api/membership/quote/route.ts` |
| 4 | Sign-in links were limited per address only | Also limited to 10 per 10 minutes per connection | `src/features/membership/authActions.ts` |
| 5 | Session cookies relied on library defaults | Set explicitly: `httpOnly`, `secure` in production, `sameSite=lax`, `path=/` | `src/lib/security/sessionCookie.ts`, `src/lib/supabase/session.ts` |
| 6 | Signed-out visitors got HTTP 200 on admin URLs, and the page title "Customer orders" was visible | Proxy returns a real 404 for admin requests with no session. The admin role is still checked on every page and action | `src/proxy.ts`, `src/lib/security/adminGate.ts` |
| 7 | No Content Security Policy | CSP added: own origin only, no framing, no foreign scripts, no `eval` in production, HTTPS upgrade | `next.config.ts` |
| 8 | Admin and member account pages could be cached or indexed | `Cache-Control: private, no-store` and `X-Robots-Tag: noindex` on those routes | `next.config.ts` |
| 9 | Public API roles kept default table privileges (row level security blocked rows, but the grants remained) | New migration revokes table and sequence access from `anon` and `authenticated` | `supabase/migrations/20261116120000_lock_down_public_tables.sql` |
| 10 | Live-looking keys sat in `.env.example` (uncommitted) | Values cleared for Resend, Supabase (URL, anon key, service role key) and the Google sheet ID and service account email | `.env.example` |
| 11 | Dependencies had moderate advisories | Non-breaking `npm audit fix`: patch updates to `typescript-eslint` and two transitive packages | `package-lock.json` |
| 12 | Suspicious activity was not logged | Warnings for rate limits, cross-site requests, bad content types, malformed or oversized bodies, honeypot hits, unsafe redirects, rejected sign-in links and denied admin access. Logs record the visitor's network (IPv4 /24, IPv6 /48), never the address | Routes above, `src/lib/http/clientIp.ts`, `src/lib/membership/access.ts` |
| 13 | One jar could be ordered past the per-jar limit by splitting it across lines | The limit now applies to the total for each jar, in the shared cart schema | `src/lib/validations/inquiry.schema.ts` |
| 14 | The quote endpoint read its body with no size limit | Body capped at 4 KB, read with the same bounded reader as the order endpoint | `src/lib/http/readBodyWithLimit.ts`, `src/app/api/membership/quote/route.ts` |

## Independent review: findings and outcome

A fresh read-only review of the uncommitted changes found no critical or high issues on the paths it traced. Its eight findings, and what was done:

| Finding | Severity | Outcome |
|---|---|---|
| Rate limits trust the first forwarded IP when the platform does not set `x-real-ip`, and counters are per instance | Medium | **Open.** Confirm `x-real-ip` on Vercel (see Needs you). The shared store is also open |
| Login CSRF through the email link, and link scanners can consume one-time tokens | Low | **Open, needs your decision** (see Needs you) |
| The IP log value was an unkeyed hash, which is reversible for IPv4 | Low | **Fixed.** Logs now record the network prefix |
| Per-jar limit bypassed by duplicate lines | Low | **Fixed** (fix 13) |
| Quote endpoint body had no size limit | Low | **Fixed** (fix 14) |
| `'unsafe-inline'` in `script-src` | Low | **Accepted.** Needed by Next.js without nonces. See Limitations |
| Lockfile changes | Info | **Intended.** They are the audit fix from item 11. `npm audit` was run before and after the fix |
| The proxy gate checks only that a session-looking cookie exists | Info | **Accepted.** Each page and action still checks the admin role. The 404 status was checked at runtime with a local request |

The review also checked, and found sound: admin and member authorization on every action, member IDOR, pricing and discount integrity, the redirect handling, CSRF on the public API routes, migration grants and row level security, secret exposure, email header and HTML injection, formula injection in the order sheet, XSS, cookie handling, honeycomb data exposure, and private-page caching.

## Checked and found sound (no change needed)

- **Admin and member actions:** every server action re-checks the session. Member actions take the user id from the session, never from the form.
- **Prices:** order prices come from the catalogue. Any price or total sent by the browser is discarded, and a test covers this.
- **Validation:** every form and action validates with Zod on the server.
- **Database access:** the app calls only service-role functions with JSON parameters. No SQL is built from strings in application code.
- **Row level security:** enabled on all 11 tables.
- **Output escaping:** email templates escape user input. The only raw-HTML scripts are constants or escaped JSON-LD. Email subjects use sanitised names, so line breaks cannot inject headers.
- **Passwords:** the app stores none. Sign-in is a one-time email link, and Supabase Auth handles any credentials.
- **File uploads:** none exist, so there is nothing to restrict yet.
- **Secrets in Git history:** no secret assignment appears in any committed file. The only non-empty `.env.example` values ever committed are a tab name, a sender address and a site URL. A private-key header in `tests/unit/orderSheet.test.ts` is a placeholder (`"abc"`), not a key.
- **Public files:** `public/` contains only images, fonts and web manifests. Source maps are not shipped. The one empty `.map` file in the build output is not referenced.
- **Debug:** no debug flags. Logging is structured and redacts names, emails, phones, addresses, notes and IPs.
- **CORS:** no CORS headers are set, so other websites cannot read API responses.
- **Existing headers:** `X-Frame-Options: DENY`, `nosniff`, referrer policy, permissions policy, and HSTS with preload were already in place and are kept.

## Dependencies

- Production dependencies: 0 known vulnerabilities.
- Full tree: 7 moderate advisories, all in ESLint tooling (`typescript-eslint` and `minimatch`). They affect development only. The fix needs a breaking major version, so I did not force it.
- `@testing-library/jest-dom` is used by `tests/setup.ts`, so it stays.

## Needs you

1. **Rotate the Resend API key, the Supabase service role key, and the Google service account key** if you use them. The values were written into `.env.example`, a file in a public repository that is easy to commit by accident. Git history shows they were never committed, so rotation is precautionary, but still recommended. Replace them in `.env.local` and in Vercel's environment variables. I cannot revoke keys without your dashboard login.
2. **Apply** `supabase/migrations/20261116120000_lock_down_public_tables.sql` in the Supabase SQL Editor. Also confirm whether `20261115120000_honeycomb_display_names.sql` has been applied.
3. **Confirm that Vercel sets `x-real-ip`.** The rate limiter prefers it. If the platform does not set it, the first `X-Forwarded-For` entry is used, and a visitor can supply that value.
4. **Decide on a shared rate-limit store.** Limits are kept in memory per server instance, so a determined attacker can spread requests across instances. The fix is a Supabase table through the service RPC, or Upstash Redis. Either adds a dependency or a migration, so it needs your approval.
5. **Decide on the email-link sign-in step.** `/auth/confirm` verifies the one-time token on the GET request. That lets an attacker start a sign-in into the victim's browser with their own link, and lets an email scanner that pre-opens links consume the token before the customer clicks it. The fix is a confirmation page with a button that submits the token. This changes the sign-in flow, so it is your call.
6. **Decide on per-recipient order limits and Turnstile.** Order emails have no limit per address or phone number, so one visitor can send many confirmation emails. Choosing those limits is a business rule, so I did not set them. Cloudflare Turnstile on the order form would also help.
7. **Supabase Auth settings:** set the email OTP (magic link) expiry to 15–30 minutes, and check the email rate limits. I could not read these settings.
8. **Supabase URL configuration:** the Site URL and redirect allow-list should contain only your HTTPS domain.
9. **Vercel:** confirm that HTTP redirects to HTTPS, and that no secret is named with a `NEXT_PUBLIC_` prefix.
10. **Delete the stray `pglite-probe.mjs`** at the drive root.

## Limitations

- **Rate limits are per server instance** (see Needs you 4).
- **CSP allows inline scripts and styles.** Next.js needs them, and nonces would force every page to render per request, which costs performance. The policy still blocks foreign scripts, `eval` in production, framing and cross-site form posts.
- **Cookies are `httpOnly`.** This is safe only while the site has no browser-side Supabase client. Review this if one is added.
- **Expired-session admin visits** can still get a 200 response with a not-found page, because the proxy checks only that a session cookie exists. The page itself still refuses non-admins.
- **Visitor networks in logs** are coarse by design: a /24 can hold many devices.
- **Database tests** run on embedded Postgres (PGlite), not your live Supabase project. The new migration has not been applied to the live project.
- **Playwright end-to-end tests were not run** in this pass.

## Test evidence

- `npx vitest run`: 356 tests in 39 files pass. Before this pass there were 285 tests in 33 files, so 71 tests and 6 test files were added. The new tests cover origin checks, JSON checks, the redirect allow-list (including the success path through the real route), cookie flags, the sign-in and quote rate limits, the admin gate, per-jar limits, the shared body reader, network labels for IPv4 and IPv6, price trust, header policy, `.env.example`, RLS on every table, and the lockdown migration.
- `npx tsc --noEmit`, `npx eslint src tests next.config.ts`: pass.
- `npm run build`: passes. The proxy is included in the build output.
- Local requests against the running app:
  - `/admin/orders` and `/admin/membership`, signed out: 404 with the "Page not found" title and no admin content.
  - Cross-site order POST: 403. Form-encoded order POST: 415. JSON order with no Origin: reaches validation (422).
  - Order with the same jar split across lines: 422 with the per-jar message.
  - Sixth order request in ten minutes: 429.
  - Cross-site quote POST: 403. Quote POST with a text body: 415. Quote POST while signed out: 200 with `signedIn: false`, without reading the body.
  - Sign-in redirect attempts with `//host`, `/%5Chost` and absolute URLs: all sent to the account page.
- Browser: home, product, and membership account pages load with no failed resources and no policy violations.

## Changed files (uncommitted)

Configuration and database: `next.config.ts`, `.env.example`, `supabase/migrations/20261116120000_lock_down_public_tables.sql`, `package-lock.json`.

Application: `src/proxy.ts`, `src/lib/security/{adminGate,requestOrigin,safeRedirect,sessionCookie}.ts`, `src/lib/http/{clientIp,readBodyWithLimit}.ts`, `src/lib/validations/inquiry.schema.ts`, `src/app/api/inquiries/route.ts`, `src/app/api/membership/quote/route.ts`, `src/app/auth/confirm/route.ts`, `src/lib/supabase/session.ts`, `src/features/membership/authActions.ts`, `src/lib/membership/access.ts`.

Tests: `tests/unit/{requestSecurity,securityConfig,adminGate,authConfirmRoute,signInRateLimit,readBodyWithLimit}.test.ts`, and `tests/unit/inquirySchema.test.ts` (original tests kept, new per-jar and price tests added).

Documentation: `docs/security-report.md`.
