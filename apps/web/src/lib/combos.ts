// Passo 1 do agendamento (backlog Cliente 07): sugerir o combo mais barato e avisar quando um
// combo já inclui um avulso escolhido. Os combos são reconhecidos pelo nome ("Corte + Barba"),
// porque o cadastro de serviços ainda não guarda os itens de cada combo.

export interface ServicoDoPasso {
  id: string
  nome: string
  precoCentavos: number
}

const partes = (nome: string) =>
  nome
    .split('+')
    .map((p) => p.trim().toLocaleLowerCase('pt-BR'))
    .filter(Boolean)

const ehCombo = (s: ServicoDoPasso) => partes(s.nome).length > 1

/** Um combo escolhido junto com um avulso que ele já inclui. */
export function avulsoRepetido(
  escolhidos: ServicoDoPasso[],
): { combo: ServicoDoPasso; avulso: ServicoDoPasso } | null {
  for (const combo of escolhidos.filter(ehCombo)) {
    const itens = partes(combo.nome)
    const avulso = escolhidos.find(
      (s) => s.id !== combo.id && !ehCombo(s) && itens.includes(partes(s.nome)[0] ?? ''),
    )
    if (avulso) return { combo, avulso }
  }
  return null
}

/** Combo que cobre exatamente os itens escolhidos e sai mais barato que eles somados. */
export function comboMaisBarato(
  escolhidos: ServicoDoPasso[],
  todos: ServicoDoPasso[],
): { combo: ServicoDoPasso; economiaCentavos: number } | null {
  if (escolhidos.length < 2) return null
  const itensEscolhidos = new Set(escolhidos.flatMap((s) => partes(s.nome)))
  const total = escolhidos.reduce((t, s) => t + s.precoCentavos, 0)
  let melhor: { combo: ServicoDoPasso; economiaCentavos: number } | null = null
  for (const combo of todos.filter(ehCombo)) {
    if (escolhidos.some((s) => s.id === combo.id)) continue
    const itens = new Set(partes(combo.nome))
    const cobre =
      itens.size === itensEscolhidos.size && [...itens].every((i) => itensEscolhidos.has(i))
    const economia = total - combo.precoCentavos
    if (cobre && economia > 0 && (!melhor || economia > melhor.economiaCentavos)) {
      melhor = { combo, economiaCentavos: economia }
    }
  }
  return melhor
}
