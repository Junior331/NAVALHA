import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@navalha/core', '@navalha/db', '@navalha/pagamentos', '@navalha/servidor'],
  // Painel e app dependem da sessão em toda tela: cacheComponents fica desligado por enquanto
  // (docs/roadmap.md, decisões).
}

export default nextConfig
