import type { NextConfig } from "next";

const SUPABASE_HOST = "snszmxawilmjqfbfdtds.supabase.co";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // No CSP script rules here (Next.js inline bootstrap); framing, plugins and base URL are locked down.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
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
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
