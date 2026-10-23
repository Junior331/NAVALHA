import { Redirect, useLocalSearchParams } from 'expo-router'

// Link universal navalha.app/<slug>/agendar: vai direto para o fluxo de agendar no app.
export default function LinkDeAgendar() {
  const { slug, servicos } = useLocalSearchParams<{ slug: string; servicos?: string }>()
  return (
    <Redirect href={{ pathname: '/agendar/[slug]', params: { slug, servicos: servicos ?? '' } }} />
  )
}
