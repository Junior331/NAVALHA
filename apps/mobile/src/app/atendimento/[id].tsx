import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Linking } from 'react-native'
import {
  Botao,
  Cartao,
  Carregando,
  Etiqueta,
  Linha,
  Mensagem,
  Tela,
  Texto,
  Titulo,
} from '../../componentes/ui'
import { api, mensagemDe } from '../../lib/api'
import { dataLonga, hora, minutosEmTexto, reais, soDigitos } from '../../lib/formato'
import { supabase } from '../../lib/supabase'
import { STATUS, type Liquidacao, type StatusAgendamento } from '../../lib/tipos'
import { useCarregar } from '../../lib/useCarregar'

// Figma Barbeiro 07 · Detalhe do atendimento: sem bloco de repasse nem taxa Navalha, só o valor
// do serviço ([regra]); iniciar, concluir e marcar no-show depois da tolerância.
export default function Atendimento() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [previaNoShow, setPreviaNoShow] = useState<Liquidacao | null>(null)
  const {
    dados: a,
    carregando,
    recarregar,
  } = useCarregar(async () => {
    const { data } = await supabase
      .from('agendamentos')
      .select(
        'id, codigo, inicio, fim, status, tolerancia_ate, observacoes, retencao_pct, clientes(nome, celular), agendamento_servicos(nome, duracao_min, preco_centavos)',
      )
      .eq('id', id)
      .single()
    return data ? { ...data, carregadoEm: Date.now() } : null
  }, [id])

  async function executar(fn: () => Promise<void>) {
    setOcupado(true)
    setErro(null)
    try {
      await fn()
      recarregar()
    } catch (e) {
      setErro(mensagemDe(e))
    } finally {
      setOcupado(false)
    }
  }

  if (carregando) {
    return (
      <Tela rolar={false}>
        <Carregando />
      </Tela>
    )
  }
  if (!a) {
    return (
      <Tela>
        <Mensagem tipo="erro">Atendimento não encontrado.</Mensagem>
      </Tela>
    )
  }

  const status = STATUS[a.status as StatusAgendamento]
  const agora = a.carregadoEm
  const valor = a.agendamento_servicos.reduce((t, s) => t + s.preco_centavos, 0)
  const duracao = a.agendamento_servicos.reduce((t, s) => t + s.duracao_min, 0)
  const celular = soDigitos(a.clientes?.celular ?? '')
  const podeIniciar =
    a.status === 'confirmado' && agora >= new Date(a.inicio).getTime() - 30 * 60_000
  const podeNoShow = a.status === 'confirmado' && agora > new Date(a.tolerancia_ate).getTime()

  return (
    <Tela>
      <Etiqueta tom={status.tom}>{status.rotulo}</Etiqueta>
      <Titulo>{a.clientes?.nome ?? 'Cliente'}</Titulo>
      <Cartao>
        <Linha
          rotulo="Quando"
          valor={`${dataLonga(a.inicio)}, ${hora(a.inicio)} a ${hora(a.fim)}`}
        />
        <Linha rotulo="Serviços" valor={a.agendamento_servicos.map((s) => s.nome).join(' + ')} />
        <Linha rotulo="Duração" valor={minutosEmTexto(duracao)} />
        <Linha rotulo="Valor do serviço" valor={reais(valor)} />
        <Linha rotulo="Código" valor={a.codigo} />
      </Cartao>
      {a.observacoes ? <Mensagem tipo="info">{a.observacoes}</Mensagem> : null}
      {celular.length >= 10 ? (
        <Botao
          variante="secundario"
          onPress={() => void Linking.openURL(`https://wa.me/55${celular.replace(/^55/, '')}`)}
        >
          Falar com o cliente no WhatsApp
        </Botao>
      ) : null}

      {podeIniciar ? (
        <Botao
          carregando={ocupado}
          onPress={() =>
            executar(async () => {
              await api(`/api/agendamentos/${id}/iniciar`, { metodo: 'POST', corpo: {} })
            })
          }
        >
          Iniciar atendimento
        </Botao>
      ) : null}
      {a.status === 'em_atendimento' ? (
        <Botao
          carregando={ocupado}
          onPress={() =>
            executar(async () => {
              await api(`/api/agendamentos/${id}/concluir`, { metodo: 'POST', corpo: {} })
            })
          }
        >
          Concluir atendimento
        </Botao>
      ) : null}
      {a.status === 'confirmado' && !podeNoShow ? (
        <Texto pequeno suave>
          Se o cliente não vier, o no-show libera depois de {hora(a.tolerancia_ate)} (tolerância de
          atraso).
        </Texto>
      ) : null}
      {podeNoShow && !previaNoShow ? (
        <Botao
          variante="secundario"
          carregando={ocupado}
          onPress={() =>
            executar(async () => {
              setPreviaNoShow(await api<Liquidacao>(`/api/agendamentos/${id}/no-show`))
            })
          }
        >
          O cliente não veio
        </Botao>
      ) : null}
      {previaNoShow ? (
        <Cartao>
          <Texto forte>Marcar no-show</Texto>
          <Texto>
            Retenção de {a.retencao_pct}%: a barbearia fica com {reais(previaNoShow.barbearia)} e o
            cliente recebe {reais(previaNoShow.devolvidoAoCliente)} de volta.
          </Texto>
          <Botao
            variante="perigo"
            carregando={ocupado}
            onPress={() =>
              executar(async () => {
                await api(`/api/agendamentos/${id}/no-show`, { metodo: 'POST', corpo: {} })
                setPreviaNoShow(null)
              })
            }
          >
            Confirmar no-show
          </Botao>
        </Cartao>
      ) : null}
      {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
    </Tela>
  )
}
