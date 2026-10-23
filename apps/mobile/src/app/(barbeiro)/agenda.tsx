import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Botao, Cartao, Carregando, Etiqueta, Tela, Texto, Vazio } from '../../componentes/ui'
import { dataLonga, hora } from '../../lib/formato'
import { useSessao } from '../../lib/sessao'
import { supabase } from '../../lib/supabase'
import { STATUS, type StatusAgendamento } from '../../lib/tipos'
import { useCarregar } from '../../lib/useCarregar'

type Aba = 'proximos' | 'concluidos' | 'cancelados'

const FILTRO: Record<Aba, StatusAgendamento[]> = {
  proximos: ['reservado', 'confirmado', 'em_atendimento'],
  concluidos: ['concluido'],
  cancelados: [
    'cancelado_no_prazo',
    'cancelado_fora_do_prazo',
    'cancelado_pela_barbearia',
    'no_show',
    'liberado',
  ],
}

// Figma Barbeiro 03 · Agenda: próximos, concluídos e cancelados.
export default function Agenda() {
  const { perfil } = useSessao()
  const membroId = perfil?.membro?.id ?? ''
  const [aba, setAba] = useState<Aba>('proximos')
  const { dados, carregando } = useCarregar(async () => {
    const consulta = supabase
      .from('agendamentos')
      .select('id, inicio, status, clientes(nome), agendamento_servicos(nome)')
      .eq('barbeiro_id', membroId)
      .in('status', FILTRO[aba])
    const { data } =
      aba === 'proximos'
        ? await consulta.gte('fim', new Date().toISOString()).order('inicio').limit(60)
        : await consulta.order('inicio', { ascending: false }).limit(60)
    return data ?? []
  }, [membroId, aba])

  return (
    <Tela>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {(['proximos', 'concluidos', 'cancelados'] as const).map((a) => (
          <View key={a} style={{ flex: 1 }}>
            <Botao variante={aba === a ? 'primario' : 'secundario'} onPress={() => setAba(a)}>
              {a === 'proximos' ? 'Próximos' : a === 'concluidos' ? 'Concluídos' : 'Cancelados'}
            </Botao>
          </View>
        ))}
      </View>
      {carregando ? (
        <Carregando />
      ) : dados && dados.length > 0 ? (
        dados.map((a) => {
          const status = STATUS[a.status as StatusAgendamento]
          return (
            <Pressable
              key={a.id}
              accessibilityRole="button"
              accessibilityLabel={`${dataLonga(a.inicio)}, ${hora(a.inicio)}, ${a.clientes?.nome}, ${status.rotulo}`}
              onPress={() => router.push(`/atendimento/${a.id}`)}
            >
              <Cartao>
                <Etiqueta tom={status.tom}>{status.rotulo}</Etiqueta>
                <Texto forte>
                  {dataLonga(a.inicio)}, {hora(a.inicio)}
                </Texto>
                <Texto suave>
                  {a.clientes?.nome ?? 'Cliente'} ·{' '}
                  {a.agendamento_servicos.map((s) => s.nome).join(' + ')}
                </Texto>
              </Cartao>
            </Pressable>
          )
        })
      ) : (
        <Vazio titulo="Nada por aqui" />
      )}
    </Tela>
  )
}
