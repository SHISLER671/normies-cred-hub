/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silence false-positive workspace root warning caused by lockfile in parent dir
  turbopack: {
    root: process.cwd(),
  },

  // Include Zulo persona + knowledge markdown in serverless traces
  outputFileTracingIncludes: {
    "/api/**/*": ["./lib/agent-recommendations/**/*.{md,ts}"],
    "/ask": ["./lib/agent-recommendations/**/*.{md,ts}"],
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.normies.art",
        pathname: "/normie/**",
      },
    ],
  },

  async redirects() {
    return [
      {
        source: "/zulo",
        destination: "/ask",
        permanent: true,
      },
      {
        source: "/zulo/:path*",
        destination: "/ask",
        permanent: true,
      },
      {
        source: "/agent-recommendations",
        destination: "/ask",
        permanent: true,
      },
      {
        source: "/agent-recommendations/:path*",
        destination: "/ask",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
