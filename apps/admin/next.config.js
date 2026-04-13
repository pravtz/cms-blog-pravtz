/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'bcryptjs'],
    instrumentationHook: true,
  },
}

module.exports = nextConfig
