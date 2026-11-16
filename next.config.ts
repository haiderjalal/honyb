import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV !== "production";

/**
 * Content Security Policy. Resources may come from this site only. Inline scripts and styles are allowed because
 * Next.js inlines its bootstrap code, the intro gate is an inline script, and the animations set inline styles.
 * Nonces would force every page to render on each request, which would cost performance, so they are not used.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDevelopment ? " ws:" : ""}`,
  "media-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

/** Pages that show a customer's or an admin's private data are never stored by shared caches or search engines. */
const privatePageHeaders = [
  { key: "Cache-Control", value: "private, no-store" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  // Every page is static (or a POST handler), so Cache Components is not needed;
  // leaving it off allows `dynamicParams = false` for hard 404s on unknown products.
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // AVIF is noticeably smaller than WebP; browsers without AVIF support fall back to WebP.
    formats: ["image/avif", "image/webp"],
    // Brand images change rarely, so browsers and the CDN can keep optimised copies for a week.
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "motion"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/admin/:path*", headers: privatePageHeaders },
      { source: "/membership/account/:path*", headers: privatePageHeaders },
      // Brand files keep their names when they are replaced, so cache them for a day rather than forever.
      {
        source: "/brand/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
};

export default nextConfig;
