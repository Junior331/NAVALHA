import { useState } from 'react'
import { View } from 'react-native'
import {
  Botao,
  Campo,
  Cartao,
  Carregando,
  Mensagem,
  Opcao,
  Subtitulo,
  Tela,
  Texto,
  Titulo,
} from '../../componentes/ui'
import { api, mensagemDe } from '../../lib/api'
import { dataCurta, hora } from '../../lib/formato'
import { useSessao } from '../../lib/sessao'
import { supabase } from '../../lib/supabase'
import { useCarregar } from '../../lib/useCarregar'

// Figma Barbeiro 04 · Disponibilidade (expediente por dia, com intervalo), 04b · Pausar agenda e
// folgas. A pausa só fecha horários novos: os agendamentos já marcados continuam.

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

interface Expediente {
  dia: number
  inicio: string
  fim: string
  pausaInicio: string
  pausaFim: string
}

export default function Disponibilidade() {
  const { perfil } = useSessao()
  const membro = perfil?.membro
  const [grade, setGrade] = useState<Expediente[] | null>(null)
  const [estado, setEstado] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [pausaDe, setPausaDe] = useState('')
  const [pausaAte, setPausaAte] = useState('')
  const [motivo, setMotivo] = useState('')

  const { dados, carregando, recarregar } = useCarregar(async () => {
    const [horarios, bloqueios] = await Promise.all([
      supabase
        .from('horarios_atendimento')
        .select('dia_semana, inicio, fim, pausa_inicio, pausa_fim')
        .eq('membro_id', membro?.id ?? ''),
      supabase
        .from('bloqueios')
        .select('id, inicio, fim, motivo')
        .eq('membro_id', membro?.id ?? '')
        .gte('fim', new Date().toISOString())
        .order('inicio'),
    ])
    return {
      expediente: (horarios.data ?? []).map((h) => ({
        dia: h.dia_semana,
        inicio: h.inicio.slice(0, 5),
        fim: h.fim.slice(0, 5),
        pausaInicio: h.pausa_inicio?.slice(0, 5) ?? '',
        pausaFim: h.pausa_fim?.slice(0, 5) ?? '',
      })),
      bloqueios: bloqueios.data ?? [],
    }
  }, [membro?.id])

  if (carregando || !dados || !membro) {
    return (
      <Tela rolar={false}>
        <Carregando />
      </Tela>
    )
  }
  const atual = grade ?? dados.expediente
  const mudar = (dia: number, campo: keyof Expediente, valor: string) =>
    setGrade(atual.map((e) => (e.dia === dia ? { ...e, [campo]: valor } : e)))
  const invalido = atual.some(
    (e) =>
      !HHMM.test(e.inicio) ||
      !HHMM.test(e.fim) ||
      e.fim <= e.inicio ||
      (e.pausaInicio || e.pausaFim
        ? !HHMM.test(e.pausaInicio) || !HHMM.test(e.pausaFim) || e.pausaFim <= e.pausaInicio
        : false),
  )

  async function salvar() {
    if (!membro) return
    setSalvando(true)
    setEstado(null)
    const trabalhando = atual.map((e) => e.dia)
    const folga = [0, 1, 2, 3, 4, 5, 6].filter((d) => !trabalhando.includes(d))
    const remocao = folga.length
      ? await supabase
          .from('horarios_atendimento')
          .delete()
          .eq('membro_id', membro.id)
          .in('dia_semana', folga)
      : { error: null }
    const gravacao = atual.length
      ? await supabase.from('horarios_atendimento').upsert(
          atual.map((e) => ({
            membro_id: membro.id,
            barbearia_id: membro.barbeariaId,
            dia_semana: e.dia,
            inicio: e.inicio,
            fim: e.fim,
            pausa_inicio: e.pausaInicio || null,
            pausa_fim: e.pausaFim || null,
          })),
        )
      : { error: null }
    setSalvando(false)
    if (remocao.error || gravacao.error) {
      setEstado({
        tipo: 'erro',
        texto: 'Não foi possível salvar. Confira os horários do expediente.',
      })
      return
    }
    setGrade(null)
    setEstado({ tipo: 'sucesso', texto: 'Expediente salvo.' })
    recarregar()
  }

  async function pausar() {
    if (!membro) return
    setEstado(null)
    const de = new Date(`${pausaDe}T00:00:00-03:00`)
    const ate = new Date(`${pausaAte}T23:59:00-03:00`)
    if (Number.isNaN(de.getTime()) || Number.isNaN(ate.getTime()) || ate <= de) {
      setEstado({
        tipo: 'erro',
        texto: 'Informe as datas no formato AAAA-MM-DD, com o fim depois do início.',
      })
      return
    }
    try {
      const r = await api<{ afetados: number }>(`/api/barbeiros/${membro.id}/pausa`, {
        corpo: {
          inicio: de.toISOString(),
          fim: ate.toISOString(),
          ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
        },
      })
      setPausaDe('')
      setPausaAte('')
      setMotivo('')
      setEstado({
        tipo: 'sucesso',
        texto: r.afetados
          ? `Agenda pausada. ${r.afetados} agendamento(s) já marcado(s) no período continuam: fale com a barbearia se precisar remarcar.`
          : 'Agenda pausada no período.',
      })
      recarregar()
    } catch (e) {
      setEstado({ tipo: 'erro', texto: mensagemDe(e) })
    }
  }

  return (
    <Tela>
      <Titulo>Meus horários</Titulo>
      <Texto suave>O expediente fica dentro do horário de funcionamento da barbearia.</Texto>
      {DIAS.map((nome, dia) => {
        const e = atual.find((x) => x.dia === dia)
        return (
          <Cartao key={nome}>
            <Opcao
              titulo={nome}
              detalhe={
                e
                  ? `${e.inicio} às ${e.fim}${e.pausaInicio ? ` · intervalo ${e.pausaInicio}–${e.pausaFim}` : ''}`
                  : 'Folga'
              }
              marcado={Boolean(e)}
              onPress={() =>
                setGrade(
                  e
                    ? atual.filter((x) => x.dia !== dia)
                    : [
                        ...atual,
                        {
                          dia,
                          inicio: '09:00',
                          fim: '19:00',
                          pausaInicio: '12:00',
                          pausaFim: '13:00',
                        },
                      ],
                )
              }
            />
            {e ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Campo
                    rotulo={`${nome}: início`}
                    value={e.inicio}
                    onChangeText={(v) => mudar(dia, 'inicio', v)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Campo
                    rotulo={`${nome}: fim`}
                    value={e.fim}
                    onChangeText={(v) => mudar(dia, 'fim', v)}
                  />
                </View>
              </View>
            ) : null}
          </Cartao>
        )
      })}
      {invalido ? (
        <Mensagem tipo="erro">Use horas no formato 09:00, com o fim depois do início.</Mensagem>
      ) : null}
      <Botao onPress={salvar} carregando={salvando} desativado={invalido || grade === null}>
        Salvar expediente
      </Botao>

      <Subtitulo>Pausar agenda ou folga</Subtitulo>
      <Texto suave>Fecha os horários novos no período. Quem já agendou continua marcado.</Texto>
      <Campo
        rotulo="De (AAAA-MM-DD)"
        value={pausaDe}
        onChangeText={setPausaDe}
        placeholder="2026-11-02"
      />
      <Campo
        rotulo="Até (AAAA-MM-DD)"
        value={pausaAte}
        onChangeText={setPausaAte}
        placeholder="2026-11-05"
      />
      <Campo
        rotulo="Motivo (opcional)"
        value={motivo}
        onChangeText={setMotivo}
        placeholder="Férias"
      />
      <Botao variante="secundario" onPress={pausar} desativado={!pausaDe || !pausaAte}>
        Pausar agenda
      </Botao>
      {estado ? <Mensagem tipo={estado.tipo}>{estado.texto}</Mensagem> : null}

      {dados.bloqueios.length > 0 ? (
        <>
          <Subtitulo>Pausas marcadas</Subtitulo>
          {dados.bloqueios.map((b) => (
            <Cartao key={b.id}>
              <Texto forte>
                {dataCurta(b.inicio)}, {hora(b.inicio)} até {dataCurta(b.fim)}, {hora(b.fim)}
              </Texto>
              {b.motivo ? <Texto suave>{b.motivo}</Texto> : null}
              <Botao
                variante="fantasma"
                onPress={async () => {
                  await supabase.from('bloqueios').delete().eq('id', b.id)
                  recarregar()
                }}
              >
                Remover pausa
              </Botao>
            </Cartao>
          ))}
        </>
      ) : null}
    </Tela>
  )
}
