import type { NextConfig } from "next";
import path from "node:path";
import os from "node:os";

const nextConfig: NextConfig = {
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
