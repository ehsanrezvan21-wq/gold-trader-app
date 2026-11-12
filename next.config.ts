import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Local-dev bridge: socket.io requests (EIO query) go straight to the
  // trading engine on :3003. Behind the Caddy gateway the XTransformPort
  // query already routes them, so this only matters on localhost.
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/socket.io",
          has: [{ type: "query", key: "XTransformPort" }],
          destination: "http://localhost:3003/socket.io",
        },
      ],
    };
  },
};

export default nextConfig;
