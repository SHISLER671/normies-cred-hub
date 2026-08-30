/** @type {import('next').NextConfig} */
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://*.walletconnect.com https://*.walletconnect.org",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://api.normies.art https://*.seadn.io https://*.walletconnect.com",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: process.cwd(),
  },

  outputFileTracingIncludes: {
    "/api/**/*": [
      "./lib/agent-recommendations/**/*.{md,ts}",
      "./lib/payments/**/*.ts",
      "./lib/security/**/*.ts",
      "./lib/validation/**/*.ts",
      "./lib/middleware/**/*.ts",
    ],
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

  async headers() {
    return [
      {
        source: "/llms.txt",
        headers: [
          ...securityHeaders,
          {
            key: "Content-Type",
            value: "text/plain; charset=utf-8",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/api/(.*)",
        headers: securityHeaders,
      },
    ]
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
