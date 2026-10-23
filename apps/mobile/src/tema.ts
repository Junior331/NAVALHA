import { useColorScheme } from 'react-native'

// Mesmos tokens do painel web (apps/web/src/app/globals.css), claro e escuro.

const claro = {
  fundo: '#fafafa',
  superficie: '#ffffff',
  superficie2: '#f6f7f8',
  texto: '#3f4655',
  texto2: '#586072',
  textoSuave: '#656d7e',
  borda: '#ecedef',
  bordaForte: '#dfe1e6',
  primario: '#1b1f27',
  primarioTexto: '#ffffff',
  marca: '#f27508',
  marcaSuave: '#fff1e5',
  marcaTexto: '#c05100',
  sucesso: '#1e7a47',
  sucessoSuave: '#e6f4ec',
  alerta: '#a5470a',
  alertaSuave: '#fdefd8',
  perigo: '#c42b1f',
  perigoSuave: '#fceceb',
  info: '#1d5bbf',
  infoSuave: '#e5edfb',
}

const escuro: typeof claro = {
  fundo: '#111318',
  superficie: '#171a20',
  superficie2: '#22262e',
  texto: '#e6e8ec',
  texto2: '#c3c7cf',
  textoSuave: '#a3a9b5',
  borda: '#262a32',
  bordaForte: '#353a44',
  primario: '#f6f7f9',
  primarioTexto: '#111318',
  marca: '#f27508',
  marcaSuave: '#2c1d10',
  marcaTexto: '#ff9a4d',
  sucesso: '#5fc48a',
  sucessoSuave: '#12301f',
  alerta: '#f2b552',
  alertaSuave: '#33270f',
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
