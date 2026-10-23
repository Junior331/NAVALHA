import { Redirect } from 'expo-router'
import { Tabs } from 'expo-router/js-tabs'
import { iconeDaAba as icone } from '../../componentes/icone'
import { Carregando, Tela } from '../../componentes/ui'
import { useSessao } from '../../lib/sessao'
import { useCores } from '../../tema'

// Abas do cliente (Figma Cliente 01, 04, 13 e 17).
export default function LayoutDoCliente() {
  const { sessao, carregando } = useSessao()
  const c = useCores()
  if (carregando) {
    return (
      <Tela rolar={false}>
        <Carregando />
      </Tela>
    )
  }
  if (!sessao) return <Redirect href="/entrar" />
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
      <Tabs.Screen name="inicio" options={{ title: 'Início', tabBarIcon: icone('home-outline') }} />
      <Tabs.Screen
        name="buscar"
        options={{ title: 'Buscar', tabBarIcon: icone('search-outline') }}
      />
      <Tabs.Screen
        name="agendamentos"
        options={{ title: 'Agendamentos', tabBarIcon: icone('calendar-outline') }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: 'Perfil', tabBarIcon: icone('person-outline') }}
      />
    </Tabs>
  )
}
