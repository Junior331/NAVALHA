import type { Contexto, Resultado } from '../contexto'

// Lote semanal da taxa da Navalha: uma transferência Pix por barbearia por semana, da subconta
// para a chave da Navalha (cartao-pre-autorizado §Transferência; ajustes-taxas §Transferência).
// Saldo zero ou negativo (G maior que a parte da Navalha) fica para a semana seguinte.

export async function fecharLoteDaSemana(
  ctx: Contexto,
  params: { semana: string; barbeariaIds?: string[] },
): Promise<Resultado<'fechado'>> {
  const filtro = params.barbeariaIds
    ? ctx.sql`and barbearia_id in ${ctx.sql(params.barbeariaIds)}`
    : ctx.sql``
  const comPendencia = await ctx.sql<{ barbearia_id: string }[]>`
    select distinct barbearia_id from public.taxas_a_transferir where lote_id is null ${filtro}`

  for (const { barbearia_id: barbeariaId } of comPendencia) {
    await ctx.sql.begin(async (tx) => {
      const taxas = await tx<{ id: string; valor_centavos: number }[]>`
        select id, valor_centavos from public.taxas_a_transferir
        where barbearia_id = ${barbeariaId} and lote_id is null
        for update`
      const total = taxas.reduce((soma, t) => soma + t.valor_centavos, 0)
      if (total <= 0) return

      const [lote] = await tx<{ id: string }[]>`
        insert into public.lotes_semanais (barbearia_id, semana, valor_centavos)
        values (${barbeariaId}, ${params.semana}, ${total})
        on conflict (barbearia_id, semana) do nothing
        returning id`
      if (!lote) return
      await tx`
        update public.taxas_a_transferir set lote_id = ${lote.id}
        where id in ${tx(taxas.map((t) => t.id))}`
    })
  }

  const filtroLotes = params.barbeariaIds
    ? ctx.sql`and l.barbearia_id in ${ctx.sql(params.barbeariaIds)}`
    : ctx.sql``
  const aTransferir = await ctx.sql<{ id: string; valor_centavos: number; subconta_id: string }[]>`
    select l.id, l.valor_centavos, s.asaas_conta_id as subconta_id
    from public.lotes_semanais l
    join public.subcontas_asaas s on s.barbearia_id = l.barbearia_id
    where l.status in ('pendente', 'falhou') ${filtroLotes}`

  for (const lote of aTransferir) {
    try {
      const { transferenciaId } = await ctx.pagamentos.transferirPix({
        subcontaId: lote.subconta_id,
        chavePix: ctx.config.chavePixNavalha,
        valor: lote.valor_centavos,
        referencia: lote.id,
      })
      await ctx.sql`
        update public.lotes_semanais set status = 'concluida', asaas_transferencia_id = ${transferenciaId}
        where id = ${lote.id}`
    } catch (erro) {
      await ctx.sql`update public.lotes_semanais set status = 'falhou' where id = ${lote.id}`
      throw erro
    }
  }
  return { resultado: 'fechado', eventos: [] }
}
