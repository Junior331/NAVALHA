import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Botao, Cartao, Carregando, Etiqueta, Tela, Texto, Vazio } from '../../componentes/ui'
import { dataLonga, hora } from '../../lib/formato'
import { useSessao } from '../../lib/sessao'
import { supabase } from '../../lib/supabase'
import { STATUS, type StatusAgendamento } from '../../lib/tipos'
import { useCarregar } from '../../lib/useCarregar'

// Figma Cliente 13 · Agendamentos: próximos e anteriores, com os status Reservado, Confirmado e
// Liberado (backlog: conferir na próxima auditoria).
export default function Agendamentos() {
  const { perfil } = useSessao()
  const [aba, setAba] = useState<'proximos' | 'anteriores'>('proximos')
  const clienteId = perfil?.cliente?.id ?? ''
  const { dados, carregando } = useCarregar(async () => {
    const agora = new Date().toISOString()
    const consulta = supabase
      .from('agendamentos')
      .select('id, inicio, status, barbearias(nome), agendamento_servicos(nome)')
      .eq('cliente_id', clienteId)
    const { data } =
      aba === 'proximos'
        ? await consulta
            .in('status', ['reservado', 'confirmado', 'em_atendimento'])
            .gte('fim', agora)
            .order('inicio')
        : await consulta.lt('inicio', agora).order('inicio', { ascending: false }).limit(50)
    return data ?? []
  }, [clienteId, aba])

  return (
    <Tela>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Botao
            variante={aba === 'proximos' ? 'primario' : 'secundario'}
            onPress={() => setAba('proximos')}
          >
            Próximos
          </Botao>
        </View>
        <View style={{ flex: 1 }}>
          <Botao
            variante={aba === 'anteriores' ? 'primario' : 'secundario'}
            onPress={() => setAba('anteriores')}
          >
            Anteriores
          </Botao>
        </View>
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
              accessibilityLabel={`${dataLonga(a.inicio)}, ${hora(a.inicio)}, ${a.barbearias?.nome}, ${status.rotulo}`}
              onPress={() => router.push(`/agendamento/${a.id}`)}
            >
              <Cartao>
                <Etiqueta tom={status.tom}>{status.rotulo}</Etiqueta>
                <Texto forte>
                  {dataLonga(a.inicio)}, {hora(a.inicio)}
                </Texto>
                <Texto suave>
                  {a.agendamento_servicos.map((s) => s.nome).join(' + ')} · {a.barbearias?.nome}
                </Texto>
              </Cartao>
            </Pressable>
          )
        })
      ) : (
        <Vazio titulo={aba === 'proximos' ? 'Nenhum horário marcado' : 'Nada por aqui ainda'}>
          {aba === 'proximos' ? (
            <Botao variante="secundario" onPress={() => router.push('/buscar')}>
              Agendar um horário
            </Botao>
          ) : null}
        </Vazio>
      )}
    </Tela>
  )
}
