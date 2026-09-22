import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // The FAQ page folded into the guide; keep old links and bookmarks alive.
    return [{ source: "/faq", destination: "/guide#faq", permanent: true }];
  },
};

export default nextConfig;
