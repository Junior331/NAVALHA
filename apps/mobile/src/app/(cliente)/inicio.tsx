import { router } from 'expo-router'
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
import { dataLonga, hora } from '../../lib/formato'
import { useSessao } from '../../lib/sessao'
import { supabase } from '../../lib/supabase'
import { STATUS, type StatusAgendamento } from '../../lib/tipos'
import { useCarregar } from '../../lib/useCarregar'

// Figma Cliente 01 · Início: próximo horário, fidelidade por barbearia (só onde ela está ligada)
// e um botão "Agendar" visível (backlog 01).
export default function Inicio() {
  const { perfil } = useSessao()
  const clienteId = perfil?.cliente?.id ?? ''
  const { dados, carregando } = useCarregar(async () => {
    const [proximo, fidelidade, avisos] = await Promise.all([
      supabase
        .from('agendamentos')
        .select('id, inicio, status, barbearias(nome), agendamento_servicos(nome)')
        .eq('cliente_id', clienteId)
        .in('status', ['reservado', 'confirmado', 'em_atendimento'])
        .gte('fim', new Date().toISOString())
        .order('inicio')
        .limit(1)
        .maybeSingle(),
      supabase
        .from('fidelidade_progresso')
        .select('cortes, barbearia_id, barbearias(nome, slug)')
        .eq('cliente_id', clienteId),
      supabase
        .from('notificacoes')
        .select('id', { count: 'exact', head: true })
        .is('lida_em', null),
    ])
    const ids = (fidelidade.data ?? []).map((f) => f.barbearia_id)
    const configs = ids.length
      ? await supabase
          .from('fidelidade_config')
          .select('barbearia_id, ativa, cortes_necessarios')
          .in('barbearia_id', ids)
      : { data: [] }
    return {
      proximo: proximo.data,
      fidelidade: (fidelidade.data ?? [])
        .map((f) => ({
          ...f,
          config: configs.data?.find((x) => x.barbearia_id === f.barbearia_id),
        }))
        .filter((f) => f.config?.ativa),
      naoLidas: avisos.count ?? 0,
    }
  }, [clienteId])

  const nome = perfil?.nome.split(' ')[0] || 'você'

  return (
    <Tela>
      <Titulo>Olá, {nome}</Titulo>
      <Botao onPress={() => router.push('/buscar')}>Agendar um horário</Botao>
      {dados && dados.naoLidas > 0 ? (
        <Botao variante="secundario" onPress={() => router.push('/notificacoes')}>
          {`${dados.naoLidas} aviso${dados.naoLidas > 1 ? 's' : ''} novo${dados.naoLidas > 1 ? 's' : ''}`}
        </Botao>
      ) : null}

      <Subtitulo>Próximo horário</Subtitulo>
      {carregando ? (
        <Carregando />
      ) : dados?.proximo ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver o próximo agendamento"
          onPress={() => router.push(`/agendamento/${dados.proximo?.id}`)}
        >
          <Cartao>
            <Etiqueta tom={STATUS[dados.proximo.status as StatusAgendamento].tom}>
              {STATUS[dados.proximo.status as StatusAgendamento].rotulo}
            </Etiqueta>
            <Texto forte>
              {dataLonga(dados.proximo.inicio)}, {hora(dados.proximo.inicio)}
            </Texto>
            <Texto>
              {dados.proximo.agendamento_servicos.map((s) => s.nome).join(' + ')} ·{' '}
              {dados.proximo.barbearias?.nome}
            </Texto>
          </Cartao>
        </Pressable>
      ) : (
        <Vazio titulo="Nenhum horário marcado">
          <Texto suave>Quando você agendar, ele aparece aqui.</Texto>
        </Vazio>
      )}

      {dados && dados.fidelidade.length > 0 ? (
        <>
          <Subtitulo>Fidelidade</Subtitulo>
          {dados.fidelidade.map((f) => {
            const meta = f.config?.cortes_necessarios ?? 5
            return (
              <Cartao key={f.barbearia_id}>
                <Texto forte>{f.barbearias?.nome}</Texto>
                <Texto suave>
                  {f.cortes >= meta
                    ? 'Você já ganhou um serviço grátis! Use ao agendar.'
                    : `${f.cortes} de ${meta} atendimentos para ganhar um serviço grátis`}
                </Texto>
                <View
                  accessibilityRole="progressbar"
                  accessibilityValue={{ min: 0, max: meta, now: Math.min(f.cortes, meta) }}
                  style={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: '#e6e2dc',
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${Math.min(100, (f.cortes / meta) * 100)}%`,
                      height: 8,
                      backgroundColor: '#e8711a',
                    }}
                  />
                </View>
              </Cartao>
            )
          })}
        </>
      ) : null}
    </Tela>
  )
}
