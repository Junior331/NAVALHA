import { ErroDeNegocio } from '@navalha/servidor'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { lerJson, tratar } from './http'

describe('tratar', () => {
  it('devolve o resultado como JSON 200', async () => {
    const resposta = await tratar(async () => ({ ok: true }))
    expect(resposta.status).toBe(200)
    expect(await resposta.json()).toEqual({ ok: true })
  })

  it('ErroDeNegocio vira o status dele, com código e mensagem para o usuário', async () => {
    const resposta = await tratar(async () => {
      throw new ErroDeNegocio('cartao_recusado', 'O cartão foi recusado.')
    })
    expect(resposta.status).toBe(402)
    expect(await resposta.json()).toEqual({
      erro: { codigo: 'cartao_recusado', mensagem: 'O cartão foi recusado.' },
    })
  })

  it('erro inesperado vira 500 sem vazar detalhes', async () => {
    const resposta = await tratar(async () => {
      throw new Error('senha do banco: xyz')
    })
    expect(resposta.status).toBe(500)
    expect(JSON.stringify(await resposta.json())).not.toContain('xyz')
  })
})

describe('lerJson', () => {
  const esquema = z.object({ nome: z.string().min(1) })

  it('valida o corpo da requisição', async () => {
    const req = new Request('http://x', { method: 'POST', body: JSON.stringify({ nome: 'Zé' }) })
    expect(await lerJson(req, esquema)).toEqual({ nome: 'Zé' })
  })

  it('corpo inválido vira dados_invalidos (400)', async () => {
    const req = new Request('http://x', { method: 'POST', body: JSON.stringify({ nome: '' }) })
    await expect(lerJson(req, esquema)).rejects.toMatchObject({
      codigo: 'dados_invalidos',
      status: 400,
    })
  })

  it('JSON malformado vira dados_invalidos (400)', async () => {
    const req = new Request('http://x', { method: 'POST', body: '{nome' })
    await expect(lerJson(req, esquema)).rejects.toMatchObject({ codigo: 'dados_invalidos' })
  })
})
