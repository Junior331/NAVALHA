import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { diaUtilDaqui } from '../dias'
import { SEED } from '../supabase'

// Roadmap 7b: agendar pelo navegador em navalha.app/<slug>, sem conta prévia, só com nome,
// celular e e-mail (cadastro leve).

async function semProblemasDeAcessibilidade(page: Page) {
  const resultado = await new AxeBuilder({ page }).analyze()
  const problemas = resultado.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
  )
  expect(problemas).toEqual([])
}

async function preencherDados(page: Page, nome: string) {
  await page.getByLabel('Nome', { exact: true }).fill(nome)
  await page.getByLabel('Celular (WhatsApp)').fill('11987650000')
  await page.getByLabel('E-mail').fill(`cliente-${Date.now()}@navalha.test`)
  await page.getByRole('button', { name: 'Ir para o pagamento' }).click()
}

test('agenda com Pix pela página pública, sem conta, e fica confirmado ao pagar', async ({
  page,
}) => {
  await page.goto(`/${SEED.slug}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Barbearia do Zé' })).toBeVisible()
  await semProblemasDeAcessibilidade(page)

  // Escolher o serviço na página já leva ao passo 2 (backlog Cliente 03).
  await page.getByRole('checkbox', { name: /Corte masculino/ }).check()
  await page.getByRole('link', { name: 'Agendar horário' }).click()
  await expect(page.getByRole('heading', { name: 'Com quem?' })).toBeVisible()
  await page.getByRole('button', { name: 'Ver horários' }).click()
  await page.locator('fieldset button').first().click()
  await semProblemasDeAcessibilidade(page)
  await page.getByRole('button', { name: 'Continuar' }).click()

  await preencherDados(page, 'Cliente Web E2E')
  await expect(page.getByText(/Cancelamento grátis até 2h antes/)).toBeVisible()
  await page.getByRole('button', { name: 'Pagar R$ 40,00 com Pix' }).click()

  await expect(page.getByRole('heading', { name: 'Pague com Pix para confirmar' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'QR Code do Pix' })).toBeVisible()
  await page.getByRole('button', { name: 'Simular pagamento do Pix' }).click()
  await expect(page.getByText('✓ Agendamento confirmado')).toBeVisible()
  await expect(page.getByText(/^NV-\d+$/)).toBeVisible()
  await expect(page.getByText('Pix de R$ 40,00 pago')).toBeVisible()
})

test('cartão a mais de 72h do fim do prazo grátis fica Reservado, sem cobrança agora', async ({
  page,
}) => {
  const dia = diaUtilDaqui(6)
  await page.goto(`/${SEED.slug}/agendar?servicos=${SEED.corteMasculino}`)
  await page.getByRole('button', { name: 'Ver horários' }).click()
  await page.getByRole('button', { name: new RegExp(`, ${dia.slice(8, 10)} de `) }).click()
  await page.locator('fieldset button').first().click()
  await page.getByRole('button', { name: 'Continuar' }).click()

  await preencherDados(page, 'Cliente Cartão E2E')
  await page.getByRole('radio', { name: /Cartão de crédito/ }).check()
  await page.getByLabel('Número do cartão').fill('4111 1111 1111 1111')
  await page.getByLabel('Nome impresso no cartão').fill('CLIENTE E2E')
  await page.getByLabel('Validade (MM/AA)').fill('12/30')
  await page.getByLabel('CVV').fill('123')
  await page.getByLabel('CPF do titular').fill('24971563792')
  await page.getByLabel('CEP do titular').fill('05413000')
  await page.getByLabel('Número do endereço').fill('120')
  await page.getByRole('button', { name: 'Reservar com cartão' }).click()

  await expect(page.getByText('Horário reservado')).toBeVisible()
  await expect(page.getByText(/Nada foi cobrado ainda/)).toBeVisible()
})
