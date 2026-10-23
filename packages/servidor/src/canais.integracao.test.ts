import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { abrirBanco } from '../test/cenarios'
import { CanalEmailResend, CanalPushExpo } from './canais'
import { NotificadorPadrao, type Aviso } from './notificacoes'

// Notificações do MVP: push no app e e-mail como fallback (decisão do roadmap, fase 5).
const sql = abrirBanco()
afterAll(() => sql.end())

function fetchQueGrava(resposta: unknown = { data: [{ status: 'ok', id: 'tkt_1' }] }) {
  const chamadas: { url: string; corpo: unknown; headers: Record<string, string> }[] = []
  const fn: typeof fetch = async (url, init) => {
    chamadas.push({
      url: String(url),
      corpo: JSON.parse(String(init?.body)),
      headers: (init?.headers ?? {}) as Record<string, string>,
    })
    return new Response(JSON.stringify(resposta), { status: 200 })
  }
  return { fn, chamadas }
}

async function usuario(email: string | null, tokens: string[] = []) {
  const id = randomUUID()
  await sql`insert into auth.users (id, email) values (${id}, ${email})`
  for (const token of tokens) {
    await sql`insert into public.dispositivos_push (expo_token, usuario_id, plataforma) values (${token}, ${id}, 'android')`
  }
  return id
}

const aviso = (usuarioId: string): Aviso => ({
  usuarioId,
  titulo: 'Seu horário é daqui a 1 hora',
  corpo: 'Barbearia do Zé, às 16:30.',
  tipo: 'lembrete',
  dados: { agendamentoId: 'ag-1' },
})

describe('CanalPushExpo', () => {
  it('manda para todos os aparelhos do usuário', async () => {
    const id = await usuario(null, [
      `ExponentPushToken[${randomUUID()}]`,
      `ExponentPushToken[${randomUUID()}]`,
    ])
    const { fn, chamadas } = fetchQueGrava({ data: [{ status: 'ok' }, { status: 'ok' }] })

    expect(await new CanalPushExpo(sql, fn).enviar(aviso(id))).toBe(true)
    expect(chamadas[0]?.url).toBe('https://exp.host/--/api/v2/push/send')
    expect(chamadas[0]?.corpo).toEqual([
      expect.objectContaining({
        title: 'Seu horário é daqui a 1 hora',
        data: { agendamentoId: 'ag-1' },
      }),
      expect.objectContaining({ title: 'Seu horário é daqui a 1 hora' }),
    ])
  })

  it('sem aparelho cadastrado, não entrega (vai para o fallback)', async () => {
    const id = await usuario(null)
    const { fn, chamadas } = fetchQueGrava()
    expect(await new CanalPushExpo(sql, fn).enviar(aviso(id))).toBe(false)
    expect(chamadas).toHaveLength(0)
  })

  it('apaga o token de aparelho que o Expo diz não existir mais', async () => {
    const token = `ExponentPushToken[${randomUUID()}]`
    const id = await usuario(null, [token])
    const { fn } = fetchQueGrava({
      data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }],
    })

    expect(await new CanalPushExpo(sql, fn).enviar(aviso(id))).toBe(false)
    const restantes = await sql`select 1 from public.dispositivos_push where expo_token = ${token}`
    expect(restantes).toHaveLength(0)
  })
})

describe('CanalEmailResend', () => {
  it('manda para o e-mail da conta', async () => {
    const id = await usuario(`lucas-${randomUUID().slice(0, 6)}@exemplo.com`)
    const { fn, chamadas } = fetchQueGrava({ id: 'email_1' })

    expect(
      await new CanalEmailResend(sql, 're_chave', 'Navalha <oi@navalha.app>', fn).enviar(aviso(id)),
    ).toBe(true)
    expect(chamadas[0]).toMatchObject({
      url: 'https://api.resend.com/emails',
      headers: expect.objectContaining({ Authorization: 'Bearer re_chave' }),
      corpo: expect.objectContaining({
        subject: 'Seu horário é daqui a 1 hora',
        from: 'Navalha <oi@navalha.app>',
      }),
    })
  })

  it('usuário anônimo usa o e-mail do cadastro leve', async () => {
    const id = await usuario(null)
    await sql`insert into public.clientes (usuario_id, nome, email) values (${id}, 'Lucas', 'leve@exemplo.com')`
    const { fn, chamadas } = fetchQueGrava({ id: 'email_2' })

    expect(
      await new CanalEmailResend(sql, 're_chave', 'Navalha <oi@navalha.app>', fn).enviar(aviso(id)),
    ).toBe(true)
    expect(chamadas[0]?.corpo).toMatchObject({ to: ['leve@exemplo.com'] })
  })
})

describe('NotificadorPadrao', () => {
  it('guarda o aviso no app e usa o e-mail só quando o push não entrega', async () => {
    const id = await usuario(`sem-app-${randomUUID().slice(0, 6)}@exemplo.com`)
    const push = fetchQueGrava()
    const email = fetchQueGrava({ id: 'email_3' })
    const notificador = new NotificadorPadrao(sql, [
      new CanalPushExpo(sql, push.fn),
      new CanalEmailResend(sql, 're_chave', 'Navalha <oi@navalha.app>', email.fn),
    ])

    await notificador.notificar(aviso(id))

    expect(push.chamadas).toHaveLength(0)
    expect(email.chamadas).toHaveLength(1)
    const noApp = await sql`select 1 from public.notificacoes where usuario_id = ${id}`
    expect(noApp).toHaveLength(1)
  })
})
