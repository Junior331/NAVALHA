import type { NextConfig } from 'next'

// Cabeçalhos de segurança em todas as respostas (revisão de segurança, fase 8). O painel e o
// checkout não podem ser emoldurados por outro site (clickjacking).
const cabecalhosDeSeguranca = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
]

const nextConfig: NextConfig = {
  transpilePackages: ['@navalha/core', '@navalha/db', '@navalha/pagamentos', '@navalha/servidor'],
  // Painel e app dependem da sessão em toda tela: cacheComponents fica desligado por enquanto
  // (docs/roadmap.md, decisões).
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: cabecalhosDeSeguranca }]
  },
}

export default nextConfig
