/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      // HTML pages: never serve a stale copy — always revalidate from the server
      {
        source: "/:path*{/}?",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
      // Hashed static assets (JS/CSS): safe to cache forever — new builds get new hashes
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
