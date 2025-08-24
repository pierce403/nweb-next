/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ]
  },
  // Enable better error reporting in development
  webpack: (config, { dev }) => {
    if (dev) {
      config.devtool = 'eval-source-map'
    }
    return config
  },
}

module.exports = nextConfig
