import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { diaUtilDaqui } from '../dias'

// Admin 02d–02j: agendar pelo balcão, abrir o evento, remarcar e cancelar.
test('agenda pelo balcão, remarca e cancela, liberando o horário', async ({ page }) => {
  const dia = diaUtilDaqui(15)
  const cliente = `Cliente E2E ${Date.now()}`
  await page.goto(`/painel/agenda?data=${dia}`)

  await page.getByRole('button', { name: 'Novo agendamento +' }).click()
  const dialogo = page.getByRole('dialog')
  await dialogo.getByRole('button', { name: 'Cadastrar cliente novo' }).click()
  await dialogo.getByLabel('Nome do cliente').fill(cliente)
  await dialogo.getByLabel('Celular (opcional)').fill('11912345678')
  await dialogo.getByRole('button', { name: 'Continuar' }).click()

  await dialogo
    .getByRole('checkbox', { name: /^Corte\b/ })
    .first()
    .check()
  await dialogo.getByRole('button', { name: 'Continuar' }).click()

  // Sem "Status inicial": o agendamento já entra confirmado (backlog 02g).
  await dialogo.locator('button[aria-pressed]').first().click()
  await dialogo.getByRole('button', { name: 'Continuar' }).click()
  await expect(dialogo.getByText('Na barbearia, fora do app')).toBeVisible()
  await expect(dialogo.getByText(/pendente/i)).toHaveCount(0)
  await dialogo.getByRole('button', { name: 'Confirmar agendamento' }).click()
  await expect(dialogo.getByText(/Agendamento NV-\d+ confirmado/)).toBeVisible()
  await expect(dialogo.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute(
    'href',
    /^https:\/\/wa\.me\/5511912345678\?text=/,
  )
  await dialogo.getByRole('button', { name: 'Concluir' }).click()

  const evento = page.getByRole('button', { name: new RegExp(cliente) })
  await evento.click()
  await expect(dialogo.getByText('Confirmado', { exact: true }).first()).toBeVisible()
  await dialogo.getByRole('button', { name: 'Remarcar' }).click()
  await dialogo.locator('button[aria-pressed]').nth(3).click()
  await dialogo.getByRole('button', { name: 'Confirmar remarcação' }).click()
  await expect(dialogo.getByText('Agendamento remarcado')).toBeVisible()
  await dialogo.getByText('Fechar', { exact: true }).click()

  await evento.click()
  await dialogo.getByRole('button', { name: 'Cancelar agendamento' }).click()
  await expect(dialogo.getByText(/Nada foi cobrado pelo app/)).toBeVisible()
  await expect(dialogo.getByRole('combobox', { name: 'Motivo' })).not.toContainText(
    'não compareceu',
  )
  await dialogo.getByRole('button', { name: 'Confirmar cancelamento' }).click()
  await expect(dialogo.getByText('Agendamento cancelado')).toBeVisible()
  await dialogo.getByText('Fechar', { exact: true }).click()

  // Cancelado sai da grade e vai para a lista de cancelados.
  await expect(page.getByRole('region', { name: /Cancelados/ })).toContainText(cliente)
})

test('a agenda não tem problemas de acessibilidade detectáveis', async ({ page }) => {
  await page.goto(`/painel/agenda?data=${diaUtilDaqui(15)}&visao=semana`)
  const resultado = await new AxeBuilder({ page }).analyze()
  const problemas = resultado.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
  )
  expect(problemas).toEqual([])
})
