// Imagens importadas como módulo: o Metro resolve para o asset do app.
declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native'
  const imagem: ImageSourcePropType
  export default imagem
}
