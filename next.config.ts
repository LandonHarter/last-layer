import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // mybase hosting runs the standalone server in a container (Dockerfile).
  output: "standalone",
};

export default nextConfig;
