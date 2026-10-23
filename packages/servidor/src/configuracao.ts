import { conectar, type Sql } from '@navalha/db'
import { AsaasProvider, FakePaymentProvider, type PaymentProvider } from '@navalha/pagamentos'
import { CanalEmailResend, CanalPushExpo } from './canais'
import type { Contexto } from './contexto'
import { NotificadorPadrao, type Canal } from './notificacoes'

// Monta o contexto dos serviços a partir das variáveis de ambiente (API e jobs usam o mesmo).
// Sem PAGAMENTOS=asaas, usa o gateway fake (desenvolvimento e testes).

export interface Ambiente {
  DATABASE_URL?: string
  PAGAMENTOS?: string
  ASAAS_URL?: string
  ASAAS_CHAVE?: string
  NAVALHA_CHAVE_PIX?: string
  CUSTO_ESTORNO_PIX_CENTAVOS?: string
  EXPO_ACCESS_TOKEN?: string
  RESEND_CHAVE?: string
  EMAIL_REMETENTE?: string
}

export function montarContexto(ambiente: Ambiente): Contexto {
  if (!ambiente.DATABASE_URL) throw new Error('DATABASE_URL não configurada')
  const sql = conectar(ambiente.DATABASE_URL)

  const canais: Canal[] = [new CanalPushExpo(sql, fetch, ambiente.EXPO_ACCESS_TOKEN)]
  if (ambiente.RESEND_CHAVE) {
    canais.push(
      new CanalEmailResend(
        sql,
        ambiente.RESEND_CHAVE,
        ambiente.EMAIL_REMETENTE ?? 'Navalha <oi@navalha.app>',
      ),
    )
  }

  return {
    sql,
    pagamentos: montarPagamentos(sql, ambiente),
    notificador: new NotificadorPadrao(sql, canais),
    agora: () => new Date(),
    config: {
      chavePixNavalha: ambiente.NAVALHA_CHAVE_PIX ?? 'financeiro@navalha.app',
      custoEstornoPix: Number(ambiente.CUSTO_ESTORNO_PIX_CENTAVOS ?? 0),
    },
  }
}

function montarPagamentos(sql: Sql, ambiente: Ambiente): PaymentProvider {
  if (ambiente.PAGAMENTOS !== 'asaas')
    return new FakePaymentProvider({ autoRegistrarSubcontas: true })
  if (!ambiente.ASAAS_URL || !ambiente.ASAAS_CHAVE) {
    throw new Error('PAGAMENTOS=asaas exige ASAAS_URL e ASAAS_CHAVE')
  }
  return new AsaasProvider({
    urlBase: ambiente.ASAAS_URL,
    chavePrincipal: ambiente.ASAAS_CHAVE,
    chaveDaSubconta: (subcontaId) => chaveDaSubcontaNoVault(sql, subcontaId),
  })
}

/** A chave de API da subconta fica no Vault (nunca em tabela legível). */
export async function chaveDaSubcontaNoVault(sql: Sql, subcontaId: string): Promise<string> {
  const [linha] = await sql<{ chave: string }[]>`
    select v.decrypted_secret as chave
    from public.subcontas_asaas s
    join vault.decrypted_secrets v on v.id = s.chave_api_secret_id
    where s.asaas_conta_id = ${subcontaId}`
  if (!linha) throw new Error(`Chave da subconta ${subcontaId} não encontrada no Vault`)
  return linha.chave
}
