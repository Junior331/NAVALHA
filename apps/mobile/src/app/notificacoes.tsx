import { router } from 'expo-router'
import { Pressable } from 'react-native'
import { Cartao, Carregando, Tela, Texto, Vazio } from '../componentes/ui'
import { dataCurta, hora } from '../lib/formato'
import { supabase } from '../lib/supabase'
import { useCarregar } from '../lib/useCarregar'

// Figma Cliente 19 e Barbeiro 12 · Notificações. Ao abrir, marca as novas como lidas.
export default function Notificacoes() {
  const { dados, carregando } = useCarregar(async () => {
    const { data } = await supabase
      .from('notificacoes')
      .select('id, titulo, corpo, tipo, dados, criada_em, lida_em')
      .order('criada_em', { ascending: false })
      .limit(50)
    await supabase
      .from('notificacoes')
      .update({ lida_em: new Date().toISOString() })
      .is('lida_em', null)
    return data ?? []
  }, [])

  if (carregando) {
    return (
      <Tela rolar={false}>
        <Carregando />
      </Tela>
    )
  }
  return (
    <Tela>
      {dados && dados.length > 0 ? (
        dados.map((n) => {
          const agendamentoId =
            n.dados && typeof n.dados === 'object' && 'agendamentoId' in n.dados
              ? String((n.dados as { agendamentoId: string }).agendamentoId)
              : null
          return (
            <Pressable
              key={n.id}
              accessibilityRole={agendamentoId ? 'button' : 'text'}
              disabled={!agendamentoId}
              onPress={() => agendamentoId && router.push(`/agendamento/${agendamentoId}`)}
            >
              <Cartao>
                <Texto forte>
                  {n.lida_em ? '' : '● '}
                  {n.titulo}
                </Texto>
                <Texto>{n.corpo}</Texto>
                <Texto pequeno suave>
                  {dataCurta(n.criada_em)}, {hora(n.criada_em)}
                </Texto>
              </Cartao>
            </Pressable>
          )
        })
      ) : (
        <Vazio titulo="Nenhuma notificação">
          <Texto suave>Confirmações, lembretes e mudanças de horário aparecem aqui.</Texto>
        </Vazio>
      )}
    </Tela>
  )
}
