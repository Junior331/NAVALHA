import { expect, test } from '@playwright/test'

// Financeiro (regras-de-negocio §Decisões: saque manual, mínimo de R$ 50 sobre o disponível) e
// Configurações (§Política de cancelamento: "Você recebe 80% do valor retido").
test('saca do disponível respeitando o mínimo de R$ 50', async ({ page }) => {
  await page.goto('/painel/financeiro')
  await expect(page.getByText('Disponível para saque')).toBeVisible()
  await expect(page.getByRole('table').first()).toContainText('Atendido')

  await page.getByRole('button', { name: 'Sacar', exact: true }).click()
  const dialogo = page.getByRole('dialog')
  await dialogo.getByLabel('Valor (R$)').fill('10')
  await expect(dialogo.getByText('O saque mínimo é de R$ 50,00')).toBeVisible()
  await expect(dialogo.getByRole('button', { name: 'Sacar por Pix' })).toBeDisabled()

  await dialogo.getByLabel('Valor (R$)').fill('50')
  await dialogo.getByRole('button', { name: 'Sacar por Pix' }).click()
  await expect(dialogo.getByText(/R\$ 50,00 a caminho da chave Pix/)).toBeVisible()
  await dialogo.getByText('Fechar', { exact: true }).click()
  await expect(page.getByRole('region', { name: 'Saques' })).toContainText('R$ 50,00')
})

test('a política mostra a divisão do valor retido e salva', async ({ page }) => {
  await page.goto('/painel/configuracoes')
  await expect(page.getByText('Você recebe 80% do valor retido.')).toBeVisible()

  const retencao = page.getByLabel('Retenção no cancelamento tardio e no no-show')
  await retencao.selectOption('30')
  await expect(
    page.getByText(
      /ele recebe R\$ 70,00 de volta, você fica com R\$ 24,00 e a Navalha com R\$ 6,00/,
    ),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Salvar política' }).click()
  await expect(page.getByText('Salvo. Vale para os agendamentos novos.')).toBeVisible()

  // Volta ao valor do seed para não afetar os outros testes.
  await page.reload()
  await page.getByLabel('Retenção no cancelamento tardio e no no-show').selectOption('50')
  await page.getByRole('button', { name: 'Salvar política' }).click()
  await expect(page.getByText('Salvo. Vale para os agendamentos novos.')).toBeVisible()
})
