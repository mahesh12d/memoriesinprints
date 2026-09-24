import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /**
       * The app already promises 25MB, in three places: the file picker's
       * accept attribute, checkUpload on the server, and the words under the
       * upload box. Next caps a server action's body at 1MB, so a 2MB
       * photograph was refused by the platform with "Body exceeded 1 MB
       * limit" before any of that ran.
       *
       * 32MB rather than 25: the limit is on the raw multipart body, so it
       * has to cover the part headers and boundaries as well as the file —
       * and a proof is a sequence of sheets uploaded together, which share
       * this budget between them.
       */
      bodySizeLimit: "32mb",
    },
  },

  async redirects() {
    // The FAQ page folded into the guide; keep old links and bookmarks alive.
    return [{ source: "/faq", destination: "/guide#faq", permanent: true }];
  },
};

export default nextConfig;
