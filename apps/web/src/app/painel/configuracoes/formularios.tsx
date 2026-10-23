'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { liquidar } from '@navalha/core'
import { Botao, Cartao, Mensagem, Selecao } from '@/componentes/ui'
import { reais } from '@/lib/formato'
import { supabaseNoNavegador } from '@/lib/supabase'
import c from '../conta.module.css'

// Política de cancelamento (regras-de-negocio §Política de cancelamento): prazo grátis, % retido
// no cancelamento tardio e no no-show, e tolerância de atraso. A barbearia fica com 80% do retido.

const PRAZOS = [1, 2, 3, 4, 6, 12, 24, 48]
const RETENCOES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
const TOLERANCIAS = [5, 10, 15, 20, 30]
const EXEMPLO = 10000

function useSalvar() {
  const router = useRouter()
  const [estado, setEstado] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null)
  const [salvando, setSalvando] = useState(false)
  async function salvar(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setSalvando(true)
    setEstado(null)
    const { error } = await fn()
    setSalvando(false)
    if (error) {
      setEstado({ tipo: 'erro', texto: 'Não foi possível salvar. Tente de novo.' })
      return
    }
    setEstado({ tipo: 'sucesso', texto: 'Salvo. Vale para os agendamentos novos.' })
    router.refresh()
  }
  return { estado, salvando, salvar }
}

export function FormularioDePolitica({
  barbeariaId,
  inicial,
}: {
  barbeariaId: string
  inicial: { prazoGratisHoras: number; retencaoPct: number; toleranciaMin: number }
}) {
  const [prazo, setPrazo] = useState(inicial.prazoGratisHoras)
  const [retencao, setRetencao] = useState(inicial.retencaoPct)
  const [tolerancia, setTolerancia] = useState(inicial.toleranciaMin)
  const { estado, salvando, salvar } = useSalvar()
  const mudou =
    prazo !== inicial.prazoGratisHoras ||
    retencao !== inicial.retencaoPct ||
    tolerancia !== inicial.toleranciaMin

  // Exemplo com a própria regra de liquidação (Pix, sem taxa do gateway, plano pago).
  const exemplo = liquidar({
    evento: 'cancelado_fora_do_prazo',
    plano: 'basic',
    meio: 'pix',
    valorPago: EXEMPLO,
    retencaoPct: retencao,
    taxaGateway: 0,
    custoEstorno: 0,
    escolhaPix: 'credito',
    custoPix: 0,
  })

  return (
    <Cartao>
      <div className={c.cartaoTitulo}>
        <div>
          <h2>Política de cancelamento</h2>
          <p>Aparece para o cliente no checkout, com os valores desta barbearia.</p>
        </div>
      </div>
      <div className={c.formulario}>
        <div className={c.linha}>
          <Selecao
            rotulo="Cancelamento grátis até"
            value={prazo}
            onChange={(e) => setPrazo(Number(e.target.value))}
          >
            {PRAZOS.map((h) => (
              <option key={h} value={h}>
                {h}h antes do horário
              </option>
            ))}
          </Selecao>
          <Selecao
            rotulo="Retenção no cancelamento tardio e no no-show"
            value={retencao}
            onChange={(e) => setRetencao(Number(e.target.value))}
          >
            {RETENCOES.map((p) => (
              <option key={p} value={p}>
                {p}% do valor pago
              </option>
            ))}
          </Selecao>
          <Selecao
            rotulo="Tolerância de atraso"
            value={tolerancia}
            onChange={(e) => setTolerancia(Number(e.target.value))}
          >
            {TOLERANCIAS.map((m) => (
              <option key={m} value={m}>
                {m} minutos
              </option>
            ))}
          </Selecao>
        </div>
        <div className={c.exemplo}>
          <p className={c.frase}>Você recebe 80% do valor retido.</p>
          <p>
            Num serviço de {reais(EXEMPLO)}, se o cliente cancelar com menos de {prazo}h ou não
            vier: ele recebe {reais(exemplo.devolvidoAoCliente)} de volta, você fica com{' '}
            {reais(exemplo.barbearia)} e a Navalha com {reais(exemplo.navalha)}. Passados{' '}
            {tolerancia} minutos do horário, a falta conta como no-show.
          </p>
        </div>
        {estado ? <Mensagem tipo={estado.tipo}>{estado.texto}</Mensagem> : null}
        <div className={c.acoes}>
          <Botao
            disabled={!mudou || salvando}
            onClick={() =>
              salvar(() =>
                supabaseNoNavegador()
                  .from('politicas_cancelamento')
                  .update({
                    prazo_gratis_horas: prazo,
                    retencao_pct: retencao,
                    tolerancia_min: tolerancia,
                  })
                  .eq('barbearia_id', barbeariaId),
              )
            }
          >
            {salvando ? 'Salvando…' : 'Salvar política'}
          </Botao>
        </div>
      </div>
    </Cartao>
  )
}

// Fidelidade (regras-de-negocio §Outras regras): opcional; o serviço grátis é custo 100% da
// barbearia, sem taxa da Navalha, e é consumido se o cliente faltar.
export function FormularioDeFidelidade({
  barbeariaId,
  servicos,
  inicial,
}: {
  barbeariaId: string
  servicos: { id: string; nome: string }[]
  inicial: { ativa: boolean; cortes: number; servicoGratisId: string }
}) {
  const [ativa, setAtiva] = useState(inicial.ativa)
  const [cortes, setCortes] = useState(inicial.cortes)
  const [servico, setServico] = useState(inicial.servicoGratisId || servicos[0]?.id || '')
  const { estado, salvando, salvar } = useSalvar()
  const mudou =
    ativa !== inicial.ativa ||
    cortes !== inicial.cortes ||
    (ativa && servico !== inicial.servicoGratisId)
  const nomeDoServico = servicos.find((s) => s.id === servico)?.nome ?? 'o serviço escolhido'

  return (
    <Cartao>
      <div className={c.cartaoTitulo}>
        <div>
          <h2>Fidelidade</h2>
          <p>O cliente ganha um serviço grátis depois de um número de atendimentos.</p>
        </div>
      </div>
      <div className={c.formulario}>
        <label className={c.marcar}>
          <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} />
          Programa de fidelidade ligado
        </label>
        {ativa ? (
          <>
            <div className={c.linha}>
              <Selecao
                rotulo="Atendimentos para ganhar"
                value={cortes}
                onChange={(e) => setCortes(Number(e.target.value))}
              >
                {[3, 4, 5, 6, 8, 10, 12, 15, 20].map((n) => (
                  <option key={n} value={n}>
                    {n} atendimentos
                  </option>
                ))}
              </Selecao>
              <Selecao
                rotulo="Serviço grátis"
                value={servico}
                onChange={(e) => setServico(e.target.value)}
              >
                {servicos.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </Selecao>
            </div>
            <p className={c.exemplo}>
              A cada {cortes} atendimentos concluídos, o cliente ganha {nomeDoServico}. O serviço
              grátis é por conta da barbearia, sem taxa da Navalha. Se o cliente faltar ao horário
              do prêmio, ele é consumido.
            </p>
          </>
        ) : null}
        {estado ? <Mensagem tipo={estado.tipo}>{estado.texto}</Mensagem> : null}
        <div className={c.acoes}>
          <Botao
            disabled={!mudou || salvando || (ativa && !servico)}
            onClick={() =>
              salvar(() =>
                supabaseNoNavegador()
                  .from('fidelidade_config')
                  .update({
                    ativa,
                    cortes_necessarios: cortes,
                    servico_gratis_id: ativa ? servico : inicial.servicoGratisId || null,
                  })
                  .eq('barbearia_id', barbeariaId),
              )
            }
          >
            {salvando ? 'Salvando…' : 'Salvar fidelidade'}
          </Botao>
        </div>
      </div>
    </Cartao>
  )
}
