import { useColorScheme } from 'react-native'

// Mesmos tokens do painel web (apps/web/src/app/globals.css), claro e escuro.

const claro = {
  fundo: '#f6f5f3',
  superficie: '#ffffff',
  superficie2: '#faf9f7',
  texto: '#16130f',
  texto2: '#4a453e',
  textoSuave: '#6b665f',
  borda: '#e6e2dc',
  bordaForte: '#cfc9c0',
  primario: '#16130f',
  primarioTexto: '#ffffff',
  marca: '#e8711a',
  marcaSuave: '#fdeedf',
  marcaTexto: '#a64d0c',
  sucesso: '#1f7a45',
  sucessoSuave: '#e3f3e9',
  alerta: '#8a5a00',
  alertaSuave: '#fbf0d9',
  perigo: '#b42318',
  perigoSuave: '#fde8e6',
  info: '#1d5bbf',
  infoSuave: '#e5edfb',
}

const escuro: typeof claro = {
  fundo: '#0f0e0c',
  superficie: '#1a1815',
  superficie2: '#211f1b',
  texto: '#f2efe9',
  texto2: '#cfc9c0',
  textoSuave: '#a39d94',
  borda: '#2e2a25',
  bordaForte: '#4a453e',
  primario: '#f2efe9',
  primarioTexto: '#16130f',
  marca: '#e8711a',
  marcaSuave: '#3a2410',
  marcaTexto: '#f3a566',
  sucesso: '#5fc48a',
  sucessoSuave: '#12301f',
  alerta: '#e8b34a',
  alertaSuave: '#33280f',
  perigo: '#f28b82',
  perigoSuave: '#3a1714',
  info: '#8ab4f8',
  infoSuave: '#142640',
}

export type Cores = typeof claro

export function useCores(): Cores {
  return useColorScheme() === 'dark' ? escuro : claro
}

export const espaco = { p: 8, m: 12, g: 16, gg: 24 }
export const raio = { p: 8, m: 12 }
