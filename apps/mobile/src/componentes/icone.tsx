import Ionicons from '@expo/vector-icons/Ionicons'
import type { ColorValue } from 'react-native'

export type NomeDoIcone = keyof typeof Ionicons.glyphMap

/** Ícone das abas, na cor que a barra de abas passa (ativa ou inativa). */
export function iconeDaAba(nome: NomeDoIcone) {
  return function IconeDaAba({ color, size }: { color: ColorValue; size: number }) {
    return (
      <Ionicons name={nome} color={typeof color === 'string' ? color : undefined} size={size} />
    )
  }
}
