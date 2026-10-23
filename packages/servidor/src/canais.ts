import type { Sql } from '@navalha/db'
import type { Aviso, Canal } from './notificacoes'

// Canais de entrega das notificações. WhatsApp entra depois, como outro Canal (decisão do
// roadmap: API oficial fora do MVP).

interface TicketExpo {
  status: 'ok' | 'error'
  details?: { error?: string }
}

export class CanalPushExpo implements Canal {
  readonly nome = 'push'

  constructor(
    private readonly sql: Sql,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly tokenDeAcesso?: string,
  ) {}

  async enviar(aviso: Aviso): Promise<boolean> {
    const dispositivos = await this.sql<{ expo_token: string }[]>`
      select expo_token from public.dispositivos_push where usuario_id = ${aviso.usuarioId}`
    if (dispositivos.length === 0) return false

    const resposta = await this.fetchFn('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(this.tokenDeAcesso ? { Authorization: `Bearer ${this.tokenDeAcesso}` } : {}),
      },
      body: JSON.stringify(
        dispositivos.map((d) => ({
          to: d.expo_token,
          title: aviso.titulo,
          body: aviso.corpo,
          data: aviso.dados ?? {},
          sound: 'default',
        })),
      ),
    })
    if (!resposta.ok) return false

    const { data: tickets = [] } = (await resposta.json()) as { data?: TicketExpo[] }
    const invalidos = dispositivos
      .filter((_, i) => tickets[i]?.details?.error === 'DeviceNotRegistered')
      .map((d) => d.expo_token)
    if (invalidos.length > 0) {
      await this
        .sql`delete from public.dispositivos_push where expo_token in ${this.sql(invalidos)}`
    }
    return tickets.some((t) => t.status === 'ok')
  }
}

export class CanalEmailResend implements Canal {
  readonly nome = 'email'

  constructor(
    private readonly sql: Sql,
    private readonly chave: string,
    private readonly remetente: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async enviar(aviso: Aviso): Promise<boolean> {
    const [destino] = await this.sql<{ email: string | null }[]>`
      select coalesce(u.email, c.email) as email
      from auth.users u left join public.clientes c on c.usuario_id = u.id
      where u.id = ${aviso.usuarioId}`
    if (!destino?.email) return false

    const resposta = await this.fetchFn('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: this.remetente,
        to: [destino.email],
        subject: aviso.titulo,
        text: aviso.corpo,
      }),
    })
    return resposta.ok
  }
}
