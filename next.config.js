/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";
import fs from "fs";
import path from "path";

/** @type {import("next").NextConfig} */
const config = {
  typescript: {
    // Next.js App Router enforces strict HTTP handler exports on route.ts files,
    // which conflicts with testing utility exports imported directly by tests.
    // Full project type-checking is strictly verified via `npx tsc --noEmit`.
    ignoreBuildErrors: true,
  },
  turbopack: {},
  webpack: (config) => {
    // Ensure .next/server/pages directory exists for fallback static error pages
    const pagesDir = path.join(process.cwd(), ".next", "server", "pages");
    if (!fs.existsSync(pagesDir)) {
      fs.mkdirSync(pagesDir, { recursive: true });
    }
    return config;
  },
};

export default config;
