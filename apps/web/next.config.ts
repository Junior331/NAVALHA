import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@navalha/core', '@navalha/db', '@navalha/pagamentos', '@navalha/servidor'],
  cacheComponents: true,
  partialPrefetching: true,
}

export default nextConfig
