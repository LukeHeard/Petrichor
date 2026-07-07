import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['100.112.15.3'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.gr-assets.com',
      },
      {
        protocol: 'https',
        hostname: 'images-na.ssl-images-amazon.com',
      },
      {
        protocol: 'https',
        hostname: 's.gr-assets.com',
      }
    ],
  },
  // /api/* proxying to the backend is handled in middleware.ts, not here - next.config.ts
  // rewrites() are resolved once at build time (baked into routes-manifest.json), so a
  // BACKEND_URL read here would be frozen at image-build time and ignored at container
  // startup. Middleware runs per-request and reads process.env live.
};

export default nextConfig;
