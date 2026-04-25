import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // konva ships a Node.js entry that optionally requires the native `canvas`
  // package. We never render konva on the server (canvas pages use
  // `dynamic({ ssr: false })`), so externalize it to keep webpack happy.
  webpack: (config) => {
    config.externals = [
      ...(config.externals ?? []),
      { canvas: "commonjs canvas" },
    ];
    return config;
  },
};

export default nextConfig;
