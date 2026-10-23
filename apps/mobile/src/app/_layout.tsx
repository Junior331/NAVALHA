import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { SessaoProvider } from '../lib/sessao'
import { useCores } from '../tema'

// App do Navalha: cliente agenda e acompanha; barbeiro (ou dono que atende) cuida da agenda.
export default function Raiz() {
  return (
    <SafeAreaProvider>
      <SessaoProvider>
        <Navegacao />
      </SessaoProvider>
    </SafeAreaProvider>
  )
}

function Navegacao() {
  const c = useCores()
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.superficie },
          headerTintColor: c.texto,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: c.fundo },
          headerBackTitle: 'Voltar',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(acesso)" options={{ headerShown: false }} />
        <Stack.Screen name="(cliente)" options={{ headerShown: false }} />
        <Stack.Screen name="(barbeiro)" options={{ headerShown: false }} />
        <Stack.Screen name="barbearia/[slug]" options={{ title: 'Barbearia' }} />
        <Stack.Screen name="agendar/[slug]" options={{ title: 'Agendar' }} />
        <Stack.Screen name="agendamento/[id]" options={{ title: 'Agendamento' }} />
        <Stack.Screen name="atendimento/[id]" options={{ title: 'Atendimento' }} />
        <Stack.Screen name="notificacoes" options={{ title: 'Notificações' }} />
        <Stack.Screen name="convite/[token]" options={{ title: 'Convite' }} />
      </Stack>
    </>
  )
}
