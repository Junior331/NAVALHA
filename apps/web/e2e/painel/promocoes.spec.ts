import { expect, test } from '@playwright/test'
import { proximo } from '../dias'
import { SEED, tokenDe } from '../supabase'

// Admin 07: "Dias válidos" é regra aplicada no checkout, não só texto (backlog 07). Roadmap 7e:
// criar cupom de fim de semana e conferir que ele não vale numa terça.
test('cupom de fim de semana criado no painel não vale numa terça', async ({ page, request }) => {
  const codigo = `FDS${Date.now() % 1_000_000}`
  await page.goto('/painel/promocoes')
  await page.getByRole('button', { name: 'Nova promoção +' }).click()
  const dialogo = page.getByRole('dialog')
  await dialogo.getByLabel('Nome', { exact: true }).fill('Fim de semana E2E')
  await dialogo.getByLabel('Código do cupom').fill(codigo)
  await dialogo.getByLabel('Desconto (%)').fill('15')
  await dialogo.getByRole('button', { name: 'Sáb' }).click()
  await dialogo.getByRole('button', { name: 'Dom' }).click()
  await expect(
    dialogo.getByText(/15% de desconto em todos os serviços, aos sábados e domingos/),
  ).toBeVisible()
  await dialogo.getByRole('button', { name: 'Publicar promoção' }).click()
  await expect(page.getByRole('row', { name: new RegExp(codigo) })).toContainText('Ativa')

  const token = await tokenDe(request, 'lucas@exemplo.com')
  const preco = (data: string) =>
    request.post('/api/agendamentos/preco', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        barbeariaId: SEED.barbeariaId,
        servicoIds: [SEED.corteMasculino],
        inicio: new Date(`${data}T14:00:00-03:00`).toISOString(),
        cupom: codigo,
      },
    })

  const terca = await preco(proximo(2))
  expect(terca.status()).toBe(400)
  expect(((await terca.json()) as { erro: { mensagem: string } }).erro.mensagem).toBe(
    'Esse cupom não vale neste dia da semana',
  )

  const sabado = await preco(proximo(6))
  expect(sabado.status()).toBe(200)
  expect(await sabado.json()).toEqual({ valorBruto: 4000, desconto: 600, valorPago: 3400 })
})
