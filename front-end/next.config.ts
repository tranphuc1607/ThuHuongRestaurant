import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  // Allow ngrok host to access HMR WebSocket in dev mode
  allowedDevOrigins: ["nonempathic-inconsolably-guadalupe.ngrok-free.dev"],
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
