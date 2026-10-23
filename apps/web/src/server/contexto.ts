import { montarContexto, type Ambiente, type Contexto, type EventoInterno } from '@navalha/servidor'
import { inngest } from '@navalha/servidor/inngest'

// Um contexto por processo (conexão com o banco, gateway, notificador). No dev, sobrevive ao
// hot reload pelo globalThis.
const global = globalThis as unknown as { __contextoNavalha?: Contexto }

export function contexto(): Contexto {
  global.__contextoNavalha ??= montarContexto(process.env as Ambiente)
  return global.__contextoNavalha
}

/**
 * Publica os eventos devolvidos pelos casos de uso. A operação já foi gravada no banco; se o
 * Inngest estiver fora, registra o erro em vez de desfazer o que o usuário fez.
 */
export async function publicar(eventos: EventoInterno[]): Promise<void> {
  if (eventos.length === 0) return
  try {
    await inngest.send(eventos)
  } catch (erro) {
    console.error('[eventos] falha ao publicar no Inngest', JSON.stringify(eventos), erro)
  }
}
