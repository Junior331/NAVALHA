import type { Sql } from '@navalha/db'
import { ErroDeNegocio } from '../erros'

// Quem está chamando. A conexão do servidor ignora o RLS, então todo caso de uso confere aqui
// se o usuário pode agir sobre a barbearia ou o agendamento.

export interface Usuario {
  id: string
  /** Sessão anônima do cadastro leve da página web. */
  anonimo: boolean
}

export type Papel = 'dono' | 'barbeiro'

export async function papelNaBarbearia(
  sql: Sql,
  usuarioId: string,
  barbeariaId: string,
): Promise<{ papel: Papel; membroId: string } | null> {
  const [membro] = await sql<{ id: string; papel: Papel }[]>`
    select id, papel from public.membros
    where usuario_id = ${usuarioId} and barbearia_id = ${barbeariaId} and ativo`
  return membro ? { papel: membro.papel, membroId: membro.id } : null
}

export async function exigirMembro(
  sql: Sql,
  usuario: Usuario,
  barbeariaId: string,
): Promise<{ papel: Papel; membroId: string }> {
  const membro = await papelNaBarbearia(sql, usuario.id, barbeariaId)
  if (!membro) throw new ErroDeNegocio('sem_permissao', 'Você não faz parte desta barbearia')
  return membro
}

export async function exigirDono(sql: Sql, usuario: Usuario, barbeariaId: string): Promise<string> {
  const membro = await exigirMembro(sql, usuario, barbeariaId)
  if (membro.papel !== 'dono') {
    throw new ErroDeNegocio('sem_permissao', 'Só o dono da barbearia pode fazer isso')
  }
  return membro.membroId
}

export async function clienteDoUsuario(sql: Sql, usuario: Usuario): Promise<string> {
  const [cliente] = await sql<{ id: string }[]>`
    select id from public.clientes where usuario_id = ${usuario.id}`
  if (!cliente) throw new ErroDeNegocio('dados_invalidos', 'Complete seu cadastro antes de agendar')
  return cliente.id
}
