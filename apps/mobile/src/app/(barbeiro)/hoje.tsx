import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import {
  Botao,
  Cartao,
  Carregando,
  Etiqueta,
  Subtitulo,
  Tela,
  Texto,
  Titulo,
  Vazio,
} from '../../componentes/ui'
import { hora, reais } from '../../lib/formato'
import { useSessao } from '../../lib/sessao'
import { supabase } from '../../lib/supabase'
import { STATUS, type StatusAgendamento } from '../../lib/tipos'
import { useCarregar } from '../../lib/useCarregar'

// Figma Barbeiro 02 · Início: sai a carteira (sacar, chave Pix) e entra "Meus ganhos", a
// produção do período. A comissão é paga pela barbearia, fora da Navalha (regras-de-negocio).
export default function Hoje() {
  const { perfil } = useSessao()
  const membroId = perfil?.membro?.id ?? ''
  const [dias, setDias] = useState<7 | 30>(7)
  const { dados, carregando } = useCarregar(async () => {
    const agora = new Date()
    const inicioDoDia = new Date(agora)
    inicioDoDia.setHours(0, 0, 0, 0)
    const fimDoDia = new Date(inicioDoDia.getTime() + 86_400_000)
    const desde = new Date(agora.getTime() - dias * 86_400_000)
    const [hoje, producao] = await Promise.all([
      supabase
        .from('agendamentos')
        .select('id, inicio, status, clientes(nome), agendamento_servicos(nome)')
        .eq('barbeiro_id', membroId)
        .gte('inicio', inicioDoDia.toISOString())
        .lt('inicio', fimDoDia.toISOString())
        .in('status', ['reservado', 'confirmado', 'em_atendimento', 'concluido', 'no_show'])
        .order('inicio'),
      supabase
        .from('agendamentos')
        .select('id, agendamento_servicos(preco_centavos)')
        .eq('barbeiro_id', membroId)
        .eq('status', 'concluido')
        .gte('inicio', desde.toISOString()),
    ])
    const atendimentos = producao.data ?? []
    return {
      hoje: hoje.data ?? [],
      atendimentos: atendimentos.length,
      producaoCentavos: atendimentos.reduce(
        (total, a) => total + a.agendamento_servicos.reduce((t, s) => t + s.preco_centavos, 0),
        0,
      ),
    }
  }, [membroId, dias])

  return (
    <Tela>
      <Titulo>Olá, {perfil?.nome.split(' ')[0] || 'tudo bem?'}</Titulo>
      <Texto suave>{perfil?.membro?.barbeariaNome}</Texto>

      <Subtitulo>Meus ganhos</Subtitulo>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Botao variante={dias === 7 ? 'primario' : 'secundario'} onPress={() => setDias(7)}>
            7 dias
          </Botao>
        </View>
        <View style={{ flex: 1 }}>
          <Botao variante={dias === 30 ? 'primario' : 'secundario'} onPress={() => setDias(30)}>
            30 dias
          </Botao>
        </View>
      </View>
      {carregando || !dados ? (
        <Carregando />
      ) : (
        <Cartao>
          <Texto suave>Produção nos últimos {dias} dias</Texto>
          <Titulo>{reais(dados.producaoCentavos)}</Titulo>
          <Texto>
            {dados.atendimentos} atendimento{dados.atendimentos === 1 ? '' : 's'} concluído
            {dados.atendimentos === 1 ? '' : 's'}
          </Texto>
          <Texto pequeno suave>
            Valor dos serviços atendidos. A sua parte é combinada com a barbearia.
          </Texto>
        </Cartao>
      )}

      <Subtitulo>Hoje</Subtitulo>
      {dados && dados.hoje.length > 0 ? (
        dados.hoje.map((a) => {
          const status = STATUS[a.status as StatusAgendamento]
          return (
            <Pressable
              key={a.id}
              accessibilityRole="button"
              accessibilityLabel={`${hora(a.inicio)}, ${a.clientes?.nome}, ${status.rotulo}`}
              onPress={() => router.push(`/atendimento/${a.id}`)}
            >
              <Cartao>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Texto forte>
                    {hora(a.inicio)} · {a.clientes?.nome ?? 'Cliente'}
                  </Texto>
                  <Etiqueta tom={status.tom}>{status.rotulo}</Etiqueta>
                </View>
                <Texto suave>{a.agendamento_servicos.map((s) => s.nome).join(' + ')}</Texto>
              </Cartao>
            </Pressable>
          )
        })
      ) : carregando ? null : (
        <Vazio titulo="Nenhum atendimento hoje" />
      )}
    </Tela>
  )
}
