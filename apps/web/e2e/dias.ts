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
