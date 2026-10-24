import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page reads the DB and the session cookie, so nothing is static.
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
