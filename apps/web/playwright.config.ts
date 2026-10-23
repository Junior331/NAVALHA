import { defineConfig, devices } from '@playwright/test'

// E2E do painel e da página pública (docs/roadmap.md, fase 8). Usa o Supabase local com o seed.
// E2E_URL aponta para um servidor já de pé (ex.: o next dev); sem ela, sobe o build de produção
// na porta 3100. PW_CANAL=chrome usa o Chrome instalado em vez do Chromium do Playwright.
const URL = process.env.E2E_URL ?? 'http://localhost:3100'

export default defineConfig({
  testDir: './e2e',
  // Os testes dividem o mesmo banco: em série, para um não mexer na agenda do outro.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: URL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(process.env.PW_CANAL ? { channel: process.env.PW_CANAL } : {}),
  },
  projects: [
    { name: 'sessao', testMatch: /sessao\.setup\.ts/ },
    {
      name: 'painel',
      dependencies: ['sessao'],
      testMatch: /painel\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.sessao/dono.json' },
    },
    { name: 'publico', testMatch: /publico\/.*\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
  ],
  ...(process.env.E2E_URL
    ? {}
    : {
        webServer: {
          command: 'npx next build && npx next start -p 3100',
          url: `${URL}/entrar`,
          timeout: 600_000,
          reuseExistingServer: !process.env.CI,
        },
      }),
})
