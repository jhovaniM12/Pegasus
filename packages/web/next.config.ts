import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pegasus/core"],
  async rewrites() {
    if (process.env.NODE_ENV === "development" && !process.env.VERCEL) {
      return [
        {
          source: "/api/:path*",
          destination: "http://localhost:3001/api/:path*",
        },
      ];
    }

    return [];
  },
};

export default nextConfig;
