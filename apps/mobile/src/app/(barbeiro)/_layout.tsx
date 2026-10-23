import { Redirect } from 'expo-router'
import { Tabs } from 'expo-router/js-tabs'
import { iconeDaAba as icone } from '../../componentes/icone'
import { Carregando, Tela } from '../../componentes/ui'
import { useSessao } from '../../lib/sessao'
import { useCores } from '../../tema'

// Abas do barbeiro (Figma Barbeiro 02, 03, 04 e 08). Sem Solicitações nem Pendentes: o
// agendamento é instantâneo (CLAUDE.md).
export default function LayoutDoBarbeiro() {
  const { sessao, perfil, carregando } = useSessao()
  const c = useCores()
  if (carregando) {
    return (
      <Tela rolar={false}>
        <Carregando />
      </Tela>
    )
  }
  if (!sessao) return <Redirect href="/entrar" />
  if (!perfil?.membro) return <Redirect href="/" />
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.texto,
        tabBarInactiveTintColor: c.textoSuave,
        tabBarStyle: { backgroundColor: c.superficie, borderTopColor: c.borda },
        headerStyle: { backgroundColor: c.superficie },
        headerTintColor: c.texto,
        sceneStyle: { backgroundColor: c.fundo },
      }}
    >
      <Tabs.Screen name="hoje" options={{ title: 'Início', tabBarIcon: icone('today-outline') }} />
      <Tabs.Screen
        name="agenda"
        options={{ title: 'Agenda', tabBarIcon: icone('calendar-outline') }}
      />
      <Tabs.Screen
        name="disponibilidade"
        options={{ title: 'Horários', tabBarIcon: icone('time-outline') }}
      />
      <Tabs.Screen
        name="conta"
        options={{ title: 'Perfil', tabBarIcon: icone('person-outline') }}
      />
    </Tabs>
  )
}
