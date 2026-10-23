import type { Sql } from '@navalha/db'

// Notificações: cada aviso vira uma linha em notificacoes (aparece no app, Cliente 19) e segue
// pelos canais configurados (push e e-mail no MVP; WhatsApp depois, atrás da mesma interface).

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
  enviar(aviso: Aviso): Promise<void>
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
    // Um canal fora do ar não pode derrubar o fluxo de dinheiro: o aviso já está no app.
    await Promise.allSettled(this.canais.map((canal) => canal.enviar(aviso)))
  }
}

export class NotificadorEmMemoria implements Notificador {
  readonly avisos: Aviso[] = []

  async notificar(aviso: Aviso): Promise<void> {
    this.avisos.push(aviso)
  }
}
