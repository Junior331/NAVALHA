import { confirmarPixPago, ErroDeNegocio } from '@navalha/servidor'
import { FakePaymentProvider } from '@navalha/pagamentos'
import { contexto, publicar } from '@/server/contexto'
import { simulacaoDePixLigada } from '@/server/dev'
import { tratar } from '@/server/http'
import { usuarioDaRequisicao } from '@/server/sessao'

// Só no desenvolvimento com o gateway de mentira: faz o papel do banco e do webhook do Asaas,
// pagando o Pix de uma reserva. Em produção (ou com o Asaas de verdade) a rota não existe.

export async function POST(requisicao: Request, { params }: RouteContext<'/api/dev/pix/[id]'>) {
  if (!simulacaoDePixLigada()) return new Response(null, { status: 404 })
  return tratar(async () => {
    await usuarioDaRequisicao(requisicao)
    const ctx = contexto()
    const reservaId = (await params).id
    const [reserva] = await ctx.sql<{ cobranca: string; subconta: string }[]>`
      select r.dados->>'cobrancaId' as cobranca, s.asaas_conta_id as subconta
      from public.reservas_horario r
      join public.subcontas_asaas s on s.barbearia_id = r.barbearia_id
      where r.id = ${reservaId}`
    if (!reserva) throw new ErroDeNegocio('nao_encontrado', 'Reserva não encontrada ou já paga')
    if (ctx.pagamentos instanceof FakePaymentProvider) {
      ctx.pagamentos.registrarSubconta(reserva.subconta)
      try {
        ctx.pagamentos.simularPixPago(reserva.cobranca)
      } catch {
        // O gateway de mentira esquece as cobranças quando o servidor reinicia.
      }
    }
    const r = await confirmarPixPago(ctx, {
      cobrancaId: reserva.cobranca,
      referencia: reservaId,
      taxaGateway: 0,
    })
    await publicar(r.eventos)
    return { resultado: r.resultado }
  })
}
