import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { mensagemDe } from './api'

// Carrega dados da tela e recarrega sempre que ela volta ao foco (ex.: depois de cancelar).
export function useCarregar<T>(carregar: () => Promise<T>, chaves: readonly unknown[]) {
  const [estado, setEstado] = useState<{
    dados: T | null
    erro: string | null
    carregando: boolean
  }>({ dados: null, erro: null, carregando: true })
  const [versao, setVersao] = useState(0)
  const chave = JSON.stringify(chaves)

  useFocusEffect(
    useCallback(() => {
      let ativo = true
      carregar().then(
        (dados) => {
          if (ativo) setEstado({ dados, erro: null, carregando: false })
        },
        (erro: unknown) => {
          if (ativo) setEstado((atual) => ({ ...atual, erro: mensagemDe(erro), carregando: false }))
        },
      )
      return () => {
        ativo = false
      }
      // A função muda a cada render; o que importa são as chaves de quem chama.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chave, versao]),
  )

  return { ...estado, recarregar: () => setVersao((v) => v + 1) }
}
