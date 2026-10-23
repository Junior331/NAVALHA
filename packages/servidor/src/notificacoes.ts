import type { Sql } from '@navalha/db'

// Notificações: cada aviso vira uma linha em notificacoes (aparece no app, Cliente 19) e segue
// pelos canais configurados, em ordem (push e, se não entregar, e-mail; WhatsApp depois).

export interface Aviso {
  usuarioId: string
  titulo: string
  corpo: string
  tipo: string
  dados?: Record<string, string>
}

export interface Notificador {
  notificar(aviso: Aviso): Promise<void>
}

export interface Canal {
  nome: string
  /** true quando entregou; false passa para o próximo canal (fallback). */
  enviar(aviso: Aviso): Promise<boolean>
}

export class NotificadorPadrao implements Notificador {
  constructor(
    private readonly sql: Sql,
    private readonly canais: Canal[] = [],
  ) {}

  async notificar(aviso: Aviso): Promise<void> {
    await this.sql`
      insert into public.notificacoes (usuario_id, titulo, corpo, tipo, dados)
      values (${aviso.usuarioId}, ${aviso.titulo}, ${aviso.corpo}, ${aviso.tipo}, ${this.sql.json(aviso.dados ?? {})})
    `
    // Entrega pelo primeiro canal que funcionar (push; e-mail como fallback). Um canal fora do ar
    // não pode derrubar o fluxo de dinheiro: o aviso já está no app.
    for (const canal of this.canais) {
      const entregue = await canal.enviar(aviso).catch(() => false)
      if (entregue) return
    }
  }
}

export class NotificadorEmMemoria implements Notificador {
  readonly avisos: Aviso[] = []

  async notificar(aviso: Aviso): Promise<void> {
    this.avisos.push(aviso)
  }
}
