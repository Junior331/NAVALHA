// Datas dos testes, no fuso da barbearia do seed (São Paulo).

export function diaUtilDaqui(dias: number): string {
  const data = new Date(Date.now() + dias * 86_400_000)
  // A equipe do seed atende de segunda a sábado.
  if (
    data.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Sao_Paulo' }) === 'Sun'
  ) {
    data.setTime(data.getTime() + 86_400_000)
  }
  return data.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

/** Próxima data (a partir de daqui a `minimo` dias) que cai no dia da semana pedido (0 = domingo). */
export function proximo(diaDaSemana: number, minimo = 2): string {
  for (let i = minimo; i < minimo + 7; i++) {
    const data = new Date(Date.now() + i * 86_400_000)
    const nomes = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const nome = data.toLocaleDateString('en-US', {
      weekday: 'short',
      timeZone: 'America/Sao_Paulo',
    })
    if (nomes.indexOf(nome) === diaDaSemana) {
      return data.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    }
  }
  throw new Error('dia da semana inválido')
}
