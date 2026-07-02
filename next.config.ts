import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Next.js from trying to bundle the native SQLite binaries
  serverExternalPackages: ["@libsql/client"],
};

export default nextConfig;
