/** @type {import('next').NextConfig} */
const nextConfig = {
  // Images are served from external APIs; keep unoptimized for now
  // to avoid extra configuration for remote patterns.
  images: {
    unoptimized: true,
  },
}

export default nextConfig
