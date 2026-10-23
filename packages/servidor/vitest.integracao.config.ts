import { defineConfig } from 'vitest/config'

// Testes contra o Postgres local (supabase db start). DATABASE_URL padrão: banco local do CLI.
export default defineConfig({
  test: {
    include: ['src/**/*.integracao.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
})
