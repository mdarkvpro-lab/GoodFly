import type { NextConfig } from "next";

const SUPABASE_HOST = "snszmxawilmjqfbfdtds.supabase.co";

const SUPABASE = `https://${SUPABASE_HOST}`;
const TURNSTILE = "https://challenges.cloudflare.com";

/**
 * Where the browser may load from or talk to. Scripts: this site (Next.js, Netlify's own script)
 * and the Cloudflare anti-robot check only. Inline scripts stay allowed because Next.js needs them
 * without per-request nonces (pages are prerendered); even so, an injected script could not load
 * code from elsewhere nor send data anywhere but this site, Supabase and Cloudflare.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${TURNSTILE}${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SUPABASE}`,
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE} wss://${SUPABASE_HOST} ${TURNSTILE}`,
  `frame-src ${TURNSTILE}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "media-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  images: {
    // Only photos from the GoodFly programme bucket may be optimised.
    remotePatterns: [new URL(`https://${SUPABASE_HOST}/storage/v1/object/public/program-images/**`)],
  },
  experimental: {
    serverActions: {
      // Programme photos are limited to 5 MB; leave room for the multipart overhead.
      bodySizeLimit: "6mb",
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The service worker must always be fresh, and may only load from this site.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
