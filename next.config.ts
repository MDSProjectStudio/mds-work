import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // permette una seconda istanza di sviluppo (es. test offline) senza conflitti
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
