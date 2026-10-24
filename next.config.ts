import type { NextConfig } from "next";

// Cache Components is off on purpose: every screen here is per-user and
// request-time, and the app has two users. Plain dynamic rendering is simpler.
const nextConfig: NextConfig = {
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
