import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@navalha/core'],
  cacheComponents: true,
  partialPrefetching: true,
}

export default nextConfig
