// Máscaras dos campos (valores, telefone, documentos, cartão). Só formatam o que aparece no campo:
// quem envia para a API continua mandando os dígitos (ou os centavos, no caso de dinheiro).

export type Mascara =
  | 'reais'
  | 'celular'
  | 'cpf'
  | 'cpfCnpj'
  | 'cep'
  | 'cartao'
  | 'validade'
  | 'cvv'
  | 'inteiro'
  | 'percentual'

export function soDigitos(texto: string): string {
  return texto.replace(/\D/g, '')
}

/**
 * Dinheiro como na maquininha: cada dígito entra pelos centavos. "2" vira "0,02", "25" vira
 * "0,25" e "2500" vira "25,00"; apagar volta uma casa. Até R$ 999.999.999,99.
 */
export function mascararReais(texto: string): string {
  const digitos = soDigitos(texto).replace(/^0+/, '').slice(0, 11)
  if (!soDigitos(texto)) return ''
  return reaisComCentavos(Number(digitos || '0'))
}

function reaisComCentavos(centavos: number): string {
  const reais = Math.floor(centavos / 100).toLocaleString('pt-BR')
  return `${reais},${String(centavos % 100).padStart(2, '0')}`
}

/** "2.428,76" → 242876. Vazio ou inválido → 0. */
export function centavosDe(texto: string): number {
  const [inteiro = '', decimal = ''] = texto.replace(/\./g, '').split(',')
  const reais = Number(soDigitos(inteiro) || '0')
  const centavos = Number(soDigitos(decimal).padEnd(2, '0').slice(0, 2))
  return reais * 100 + centavos
}

/** 242876 → "2.428,76" e 5000 → "50,00" (para preencher o campo a partir de um valor salvo). */
export function reaisParaCampo(centavos: number): string {
  return centavos ? reaisComCentavos(centavos) : ''
}

/** (11) 98765-4321 ou (11) 3456-7890. */
export function mascararCelular(texto: string): string {
  const d = soDigitos(texto)
    .replace(/^55(?=\d{10,11}$)/, '')
    .slice(0, 11)
  if (d.length <= 2) return d ? `(${d}` : ''
  const ddd = d.slice(0, 2)
  const numero = d.slice(2)
  const corte = numero.length > 8 ? 5 : 4
  return numero.length > corte
    ? `(${ddd}) ${numero.slice(0, corte)}-${numero.slice(corte)}`
    : `(${ddd}) ${numero}`
}

function aplicarPadrao(digitos: string, padrao: string): string {
  let saida = ''
  let i = 0
  for (const c of padrao) {
    if (i >= digitos.length) break
    if (c === '0') saida += digitos[i++]
    else saida += c
  }
  return saida
}

export function mascararCpf(texto: string): string {
  return aplicarPadrao(soDigitos(texto).slice(0, 11), '000.000.000-00')
}

/** CPF até 11 dígitos; a partir do 12º, CNPJ. */
export function mascararCpfCnpj(texto: string): string {
  const d = soDigitos(texto).slice(0, 14)
  return d.length <= 11 ? mascararCpf(d) : aplicarPadrao(d, '00.000.000/0000-00')
}

export function mascararCep(texto: string): string {
  return aplicarPadrao(soDigitos(texto).slice(0, 8), '00000-000')
}

/** Grupos de 4 (até 19 dígitos). */
export function mascararCartao(texto: string): string {
  return (
    soDigitos(texto)
      .slice(0, 19)
      .match(/.{1,4}/g)
      ?.join(' ') ?? ''
  )
}

/** MM/AA */
export function mascararValidade(texto: string): string {
  return aplicarPadrao(soDigitos(texto).slice(0, 4), '00/00')
}

/** Campo que aceita WhatsApp ou e-mail: formata como celular só quando não há letra nem @. */
export function contatoMascarado(texto: string): string {
  return /[a-z@]/i.test(texto) || !/\d/.test(texto) ? texto : mascararCelular(texto)
}

export function aplicarMascara(mascara: Mascara, texto: string): string {
  switch (mascara) {
    case 'reais':
      return mascararReais(texto)
    case 'celular':
      return mascararCelular(texto)
    case 'cpf':
      return mascararCpf(texto)
    case 'cpfCnpj':
      return mascararCpfCnpj(texto)
    case 'cep':
      return mascararCep(texto)
    case 'cartao':
      return mascararCartao(texto)
    case 'validade':
      return mascararValidade(texto)
    case 'cvv':
      return soDigitos(texto).slice(0, 4)
    case 'inteiro':
      return soDigitos(texto)
        .replace(/^0+(?=\d)/, '')
        .slice(0, 9)
    case 'percentual': {
      const d = soDigitos(texto)
        .replace(/^0+(?=\d)/, '')
        .slice(0, 3)
      return d && Number(d) > 100 ? '100' : d
    }
  }
}

/** Teclado do celular certo para cada máscara. */
export const TECLADO: Record<Mascara, 'numeric' | 'decimal' | 'tel'> = {
  reais: 'numeric',
  celular: 'tel',
  cpf: 'numeric',
  cpfCnpj: 'numeric',
  cep: 'numeric',
  cartao: 'numeric',
  validade: 'numeric',
  cvv: 'numeric',
  inteiro: 'numeric',
  percentual: 'numeric',
}

/**
 * Onde o cursor deve ficar depois de formatar: logo depois do mesmo número de dígitos (e vírgula)
 * que havia antes dele, para editar no meio do valor sem o cursor pular para o fim.
 */
export function posicaoDoCursor(digitado: string, cursor: number, formatado: string): number {
  const conta = digitado.slice(0, cursor).replace(/[^\d,]/g, '').length
  if (conta === 0) return 0
  let vistos = 0
  for (let i = 0; i < formatado.length; i++) {
    if (/[\d,]/.test(formatado.charAt(i))) vistos++
    if (vistos === conta) return i + 1
  }
  return formatado.length
}
