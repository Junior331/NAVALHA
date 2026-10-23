'use client'

import {
  barbeirosQueFazem,
  duracaoTotal,
  horariosLivres,
  liquidar,
  minutos,
  paraHHMM,
  percentualPraBaixo,
  type EventoFinal,
  type EscolhaPixNoPrazo,
  type MeioPagamento,
  type Plano,
} from '@navalha/core'
import { useState } from 'react'
import estilos from './laboratorio.module.css'

// Página interna para ver as regras do @navalha/core funcionando antes das telas de produto
// (fase 6 do docs/roadmap.md). Os dados são o exemplo da Barbearia do Zé.

const SERVICOS = [
  { id: 'corte-barba', nome: 'Corte + Barba', duracaoMin: 50, preco: 5500 },
  { id: 'corte', nome: 'Corte masculino', duracaoMin: 40, preco: 4000 },
  { id: 'degrade', nome: 'Degradê', duracaoMin: 45, preco: 4500 },
  { id: 'barba', nome: 'Barba', duracaoMin: 30, preco: 3000 },
  { id: 'sobrancelha', nome: 'Sobrancelha', duracaoMin: 15, preco: 1500 },
  { id: 'pigmentacao', nome: 'Pigmentação', duracaoMin: 40, preco: 6000 },
]

const BARBEIROS = [
  { id: 'Zé Barbosa', servicoIds: ['corte-barba', 'corte', 'barba', 'sobrancelha'] },
  { id: 'Rafael Lima', servicoIds: ['corte-barba', 'degrade', 'barba', 'sobrancelha'] },
  { id: 'Diego Souza', servicoIds: ['corte', 'barba', 'pigmentacao'] },
]

const OCUPADOS = [
  { inicio: minutos('09:00'), fim: minutos('10:00') },
  { inicio: minutos('14:00'), fim: minutos('15:05') },
]

const EVENTOS: { valor: EventoFinal; rotulo: string }[] = [
  { valor: 'concluido', rotulo: 'Atendimento concluído' },
  { valor: 'cancelado_no_prazo', rotulo: 'Cliente cancelou no prazo' },
  { valor: 'cancelado_fora_do_prazo', rotulo: 'Cliente cancelou fora do prazo' },
  { valor: 'no_show', rotulo: 'No-show' },
  { valor: 'cancelado_pela_barbearia', rotulo: 'Barbearia cancelou' },
]

const reais = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const taxaDoCartao = (valor: number) => percentualPraBaixo(valor, 299) + 49

export function Laboratorio() {
  return (
    <main className={estilos.pagina}>
      <header className={estilos.cabecalho}>
        <span className={estilos.selo}>Laboratório · sprint 1</span>
        <h1>Navalha</h1>
        <p>
          As regras de dinheiro, estado e agenda já existem em <code>@navalha/core</code>, com 106
          testes. As telas de produto começam na fase 6. Esta página usa o código real para você
          testar as regras.
        </p>
      </header>
      <SimuladorLiquidacao />
      <SimuladorAgenda />
    </main>
  )
}

function SimuladorLiquidacao() {
  const [valorReais, setValorReais] = useState(100)
  const [plano, setPlano] = useState<Plano>('free')
  const [meio, setMeio] = useState<MeioPagamento>('cartao')
  const [evento, setEvento] = useState<EventoFinal>('concluido')
  const [retencaoPct, setRetencaoPct] = useState(50)
  const [escolhaPix, setEscolhaPix] = useState<EscolhaPixNoPrazo>('credito')

  const valorPago = Math.max(0, Math.round(valorReais * 100))
  const taxaGateway = meio === 'cartao' ? taxaDoCartao(valorPago) : 0
  const r = liquidar({
    evento,
    plano,
    meio,
    valorPago,
    retencaoPct,
    taxaGateway,
    custoEstorno: meio === 'cartao' ? taxaGateway : 0,
    escolhaPix,
    custoPix: 0,
  })

  return (
    <section className={estilos.cartao} aria-labelledby="titulo-liquidacao">
      <h2 id="titulo-liquidacao">Quem fica com quanto</h2>
      <p className={estilos.ajuda}>
        Liquidação no evento final (regras-de-negocio §Cenários de liquidação). Cartão com tarifa
        cheia do Asaas: 2,99% + R$ 0,49.
      </p>

      <div className={estilos.campos}>
        <label>
          Valor pago (R$)
          <input
            type="number"
            min={0}
            step={1}
            value={valorReais}
            onChange={(e) => setValorReais(Number(e.target.value))}
          />
        </label>
        <label>
          Plano
          <select value={plano} onChange={(e) => setPlano(e.target.value as Plano)}>
            <option value="free">Free (8% por atendimento)</option>
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
          </select>
        </label>
        <label>
          Meio de pagamento
          <select value={meio} onChange={(e) => setMeio(e.target.value as MeioPagamento)}>
            <option value="cartao">Cartão</option>
            <option value="pix">Pix</option>
          </select>
        </label>
        <label>
          Evento final
          <select value={evento} onChange={(e) => setEvento(e.target.value as EventoFinal)}>
            {EVENTOS.map((ev) => (
              <option key={ev.valor} value={ev.valor}>
                {ev.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label>
          Retenção da barbearia: {retencaoPct}%
          <input
            type="range"
            min={0}
            max={100}
            step={10}
            value={retencaoPct}
            onChange={(e) => setRetencaoPct(Number(e.target.value))}
          />
        </label>
        {meio === 'pix' && evento === 'cancelado_no_prazo' && (
          <label>
            Cliente escolheu
            <select
              value={escolhaPix}
              onChange={(e) => setEscolhaPix(e.target.value as EscolhaPixNoPrazo)}
            >
              <option value="credito">Crédito de 100% na barbearia</option>
              <option value="reembolso">Reembolso</option>
            </select>
          </label>
        )}
      </div>

      <dl className={estilos.resultado}>
        <Linha rotulo="Volta para o cliente" valor={r.devolvidoAoCliente} />
        <Linha rotulo="Crédito do cliente na barbearia" valor={r.creditoAoCliente} />
        <Linha rotulo="Barbearia fica com" valor={r.barbearia} destaque />
        <Linha rotulo="Navalha fica com" valor={r.navalha} />
        <Linha rotulo={`Taxa do gateway (paga por: ${r.quemPagaGateway})`} valor={r.custoGateway} />
      </dl>
    </section>
  )
}

function Linha({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className={destaque ? estilos.destaque : undefined}>
      <dt>{rotulo}</dt>
      <dd className={valor < 0 ? estilos.negativo : undefined}>{reais(valor)}</dd>
    </div>
  )
}

function SimuladorAgenda() {
  const [escolhidos, setEscolhidos] = useState<string[]>(['corte-barba', 'sobrancelha'])
  const servicos = SERVICOS.filter((s) => escolhidos.includes(s.id))
  const barbeiros = escolhidos.length ? barbeirosQueFazem(escolhidos, BARBEIROS) : []
  const duracao = servicos.length ? duracaoTotal(servicos) : 0
  const total = servicos.reduce((soma, s) => soma + s.preco, 0)
  const horarios = duracao
    ? horariosLivres({
        expediente: {
          inicio: minutos('09:00'),
          fim: minutos('19:00'),
          pausas: [{ inicio: minutos('12:00'), fim: minutos('13:00') }],
        },
        bloqueios: [],
        ocupados: OCUPADOS,
        duracaoMin: duracao,
        passoMin: 15,
      })
    : []

  const alternar = (id: string) =>
    setEscolhidos((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]))

  return (
    <section className={estilos.cartao} aria-labelledby="titulo-agenda">
      <h2 id="titulo-agenda">Agenda de uma segunda-feira</h2>
      <p className={estilos.ajuda}>
        Expediente 09:00–19:00 com intervalo às 12:00. Já ocupados: 09:00–10:00 e 14:00–15:05.
      </p>

      <fieldset className={estilos.servicos}>
        <legend>Serviços</legend>
        {SERVICOS.map((s) => (
          <label key={s.id} className={estilos.opcao}>
            <input
              type="checkbox"
              checked={escolhidos.includes(s.id)}
              onChange={() => alternar(s.id)}
            />
            {s.nome}
            <span>
              {s.duracaoMin} min · {reais(s.preco)}
            </span>
          </label>
        ))}
      </fieldset>

      {escolhidos.length === 0 ? (
        <p className={estilos.vazio}>Escolha ao menos um serviço.</p>
      ) : (
        <>
          <p className={estilos.resumo}>
            {duracao} min · {reais(total)} ·{' '}
            {barbeiros.length
              ? `Atendem: ${barbeiros.join(', ')}`
              : 'Nenhum barbeiro faz todos esses serviços'}
          </p>
          <ul className={estilos.horarios} aria-label="Horários livres">
            {horarios.map((h) => (
              <li key={h}>{paraHHMM(h)}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
