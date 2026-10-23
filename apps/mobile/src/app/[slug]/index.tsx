import { Redirect, useLocalSearchParams } from 'expo-router'

// Link universal navalha.app/<slug>: abre a página da barbearia dentro do app.
export default function LinkDaBarbearia() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  return <Redirect href={`/barbearia/${slug}`} />
}
