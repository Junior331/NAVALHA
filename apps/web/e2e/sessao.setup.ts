import { expect, test as setup } from '@playwright/test'

// Entra uma vez como o dono do seed (senha local navalha123) e guarda a sessão para o painel.
setup('entrar como dono da barbearia', async ({ page }) => {
  await page.goto('/entrar')
  await page.getByLabel('E-mail').fill('ze@barbeariadoze.com')
  await page.getByLabel('Senha').fill('navalha123')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/painel/)
  await page.context().storageState({ path: 'e2e/.sessao/dono.json' })
})
