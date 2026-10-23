import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Rotas da API contra o Postgres local (supabase db start).
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['src/**/*.integracao.test.ts'],
    testTimeout: 20_000,
  },
})
