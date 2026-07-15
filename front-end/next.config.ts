import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  // Allow ngrok host to access HMR WebSocket in dev mode
  allowedDevOrigins: ["nonempathic-inconsolably-guadalupe.ngrok-free.dev"],
  // Proxy /proxy-api/** → backend at localhost:8080 so iPhone (via ngrok) can reach the API
  async rewrites() {
    return [
      {
        source: "/proxy-api/:path*",
        destination: "http://localhost:8080/api/v1/:path*",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/ban/:qrToken*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default nextConfig;
