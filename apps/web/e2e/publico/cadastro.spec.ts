import { expect, test } from '@playwright/test'
import { codigoDoEmail } from '../mailpit'

// Acessos + onboarding + Ativar recebimentos (ajustes-taxas §Subconta): sem ativar, a barbearia
// configura tudo mas não aceita agendamentos pagos; ativou, aceita.
test('dono novo: cadastro, onboarding e ativação dos recebimentos', async ({ page, request }) => {
  const marca = Date.now()
  const email = `dono-${marca}@navalha.test`

  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Dono E2E')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill('senha-e2e-123')
  await page.getByRole('button', { name: 'Continuar' }).click()

  await page.getByLabel('Código').fill(await codigoDoEmail(request, email))
  await page.getByRole('button', { name: 'Confirmar' }).click()

  await page.getByLabel('Nome da barbearia').fill(`Barbearia E2E ${marca}`)
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: /^Free/ }).click()
  await page.getByRole('button', { name: 'Criar barbearia' }).click()
  await page.getByRole('link', { name: 'Configurar a barbearia' }).click()

  // Pula equipe e serviços, salva os horários padrão e deixa os recebimentos para depois.
  await page.getByRole('button', { name: 'Pular por agora' }).click()
  await page.getByRole('button', { name: 'Pular por agora' }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByRole('heading', { name: 'Ative os recebimentos' })).toBeVisible()
  await page.getByRole('button', { name: 'Fazer depois' }).click()
  await page.getByRole('link', { name: 'Ir para o painel', exact: true }).click()

  const aviso = page.getByRole('status').filter({ hasText: 'Ative os recebimentos' })
  await expect(aviso).toBeVisible()
  await page.goto('/painel/perfil')
  await expect(page.getByRole('switch', { name: 'Aceitar agendamentos online' })).toBeDisabled()

  await page.goto('/painel/recebimentos')
  await page.getByLabel('Nome completo ou razão social').fill('Dono E2E')
  await page.getByLabel('CPF ou CNPJ').fill('24971563792')
  await page.getByLabel('Celular', { exact: true }).fill('11987654321')
  await page.getByLabel('Faturamento mensal estimado (R$)').fill('8000')
  await page.getByLabel('CEP', { exact: true }).fill('05413000')
  await page.getByLabel('Bairro', { exact: true }).fill('Pinheiros')
  await page.getByLabel('Rua', { exact: true }).fill('Rua Augusta')
  await page.getByLabel('Número', { exact: true }).fill('120')
  await page.getByLabel('Chave Pix da barbearia').fill(email)
  await page.getByRole('button', { name: 'Ativar recebimentos' }).click()
  await expect(page.getByText(/Recebimentos ativos desde/)).toBeVisible()

  await page.goto('/painel/perfil')
  await expect(page.getByRole('switch', { name: 'Aceitar agendamentos online' })).toBeChecked()
  await expect(aviso).toHaveCount(0)
})
