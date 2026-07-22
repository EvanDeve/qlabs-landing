import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Server Actions default to a 1MB body limit. Portfolio uploads allow up to
    // 25MB (MAX_PORTFOLIO_FILE_BYTES) and campaign deliveries up to 200MB
    // (MAX_DELIVERY_FILE_BYTES) — raised past the larger of the two.
    serverActions: {
      bodySizeLimit: "210mb",
    },
  },
};

export default nextConfig;
