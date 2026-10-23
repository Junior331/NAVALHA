// Atalhos de desenvolvimento com o gateway de mentira (PAGAMENTOS=fake): nunca em produção.
export function simulacaoDePixLigada(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.PAGAMENTOS !== 'asaas'
}
