import postgres from 'postgres'
import type { Database } from './database.types'

export type { Database, Json } from './database.types'

type Public = Database['public']
export type Tabela<T extends keyof Public['Tables']> = Public['Tables'][T]['Row']
export type Enum<T extends keyof Public['Enums']> = Public['Enums'][T]

export type Sql = postgres.Sql<{ bigint: number }>
export type Transacao = postgres.TransactionSql<{ bigint: number }>

// Centavos cabem com folga em Number.MAX_SAFE_INTEGER; passou disso, é erro de dado.
const int8ComoNumber = {
  to: 20,
  from: [20],
  serialize: (valor: number) => String(valor),
  parse: (valor: string) => {
    const numero = Number(valor)
    if (!Number.isSafeInteger(numero))
      throw new RangeError(`int8 fora do intervalo seguro: ${valor}`)
    return numero
  },
}

/**
 * Conexão do servidor (API e jobs) com o Postgres. Usa a role do servidor, que não passa pelo
 * RLS: toda regra de acesso precisa ser checada antes, na camada de serviço.
 */
export function conectar(url: string, opcoes: { max?: number } = {}): Sql {
  return postgres(url, {
    max: opcoes.max ?? 5,
    prepare: false,
    transform: { undefined: null },
    types: { bigint: int8ComoNumber },
  })
}
