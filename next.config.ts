import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // forbidden() → HTTP 403 + app/forbidden.tsx (used when the guard denies a page).
  experimental: { authInterrupts: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
