import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/configuracion",
        destination: "/taller",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
