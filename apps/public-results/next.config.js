/** @type {import('next').NextConfig} */
const nextConfig = {
  // Public results app is read-only — no server actions needed
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

module.exports = nextConfig
