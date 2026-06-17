/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silence false-positive workspace root warning caused by lockfile in parent dir
  turbopack: {
    root: process.cwd(),
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.normies.art',
        pathname: '/normie/**',
      },
    ],
  },
}

export default nextConfig
