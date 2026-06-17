/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silence false-positive workspace root warning caused by lockfile in parent dir
  turbopack: {
    root: process.cwd(),
  },

  // Images are served from external APIs
  images: {
    unoptimized: true,
  },
}

export default nextConfig
