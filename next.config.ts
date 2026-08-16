import type { NextConfig } from "next";
import path from "node:path";
import os from "node:os";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: "base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'; upgrade-insecure-requests" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // This project lives under OneDrive, which actively locks/moves files
      // mid-write and corrupts webpack's persistent disk cache (ENOENT on
      // *.pack.gz). Fully disabling the cache "fixed" the corruption but made
      // every route a cold recompile (15s+ tab switches). Instead, redirect
      // just the cache directory to %LOCALAPPDATA% (never OneDrive-synced) so
      // caching stays on and restarts/navigations stay fast.
      config.cache = {
        type: "filesystem",
        cacheDirectory: path.join(
          process.env.LOCALAPPDATA || os.tmpdir(),
          "tableflow-webpack-cache"
        ),
      };
    }
    return config;
  },
};

export default nextConfig;
