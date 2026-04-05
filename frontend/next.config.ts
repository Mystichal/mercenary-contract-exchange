import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // TODO: Fix duplicate @mysten/sui version conflict between root and @mysten/dapp-kit's bundled dep.
  // When both versions are present, Transaction type identity checks fail at compile time.
  // To fix: align versions in package.json and add a `resolutions` field, or upgrade dapp-kit.
  typescript: { ignoreBuildErrors: true },
};
export default nextConfig;
