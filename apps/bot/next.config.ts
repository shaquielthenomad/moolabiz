import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  env: {
    NEXT_PUBLIC_BUSINESS_SLUG: process.env.BUSINESS_SLUG,
  },
};

export default nextConfig;
