import { Redirect, Stack } from 'expo-router'
import { useSessao } from '../../lib/sessao'
import { useCores } from '../../tema'

// Acessos (Figma Mobile 05–09): entrar, criar conta com código por e-mail e recuperar a senha.
export default function LayoutDeAcesso() {
  const { sessao, perfil, carregando } = useSessao()
  const c = useCores()
  // Quem já entrou (e já tem cadastro de cliente ou de equipe) não volta para o login.
  if (!carregando && sessao && (perfil?.cliente || perfil?.membro)) return <Redirect href="/" />
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.superficie },
        headerTintColor: c.texto,
        contentStyle: { backgroundColor: c.fundo },
        headerBackTitle: 'Voltar',
      }}
    >
      <Stack.Screen name="entrar" options={{ title: 'Entrar', headerShown: false }} />
      <Stack.Screen name="cadastro" options={{ title: 'Criar conta' }} />
      <Stack.Screen name="verificar" options={{ title: 'Confirmar e-mail' }} />
      <Stack.Screen name="recuperar" options={{ title: 'Recuperar senha' }} />
    </Stack>
  )
}
