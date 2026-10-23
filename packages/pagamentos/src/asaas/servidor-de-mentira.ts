// Servidor Asaas de mentira para testar o AsaasProvider sem rede. Reproduz os endpoints da API v3
// que o adaptador usa, com as respostas no formato do Asaas. Ele codifica o nosso entendimento da
// API: o que vale de verdade é a suíte de contrato rodando contra o sandbox.

export const CARTAO_RECUSADO_DE_MENTIRA = '5184019740373151'

interface Pagamento {
  object: 'payment'
  id: string
  customer: string
  status: string
  value: number
  netValue: number
  billingType: 'PIX' | 'CREDIT_CARD'
  externalReference: string | null
  confirmedDate: string | null
  deleted: boolean
  conta: string
}

interface Requisicao {
  metodo: string
  caminho: string
  headers: Record<string, string>
  corpo: Record<string, unknown> | undefined
}

export function criarAsaasDeMentira(config: { chavePrincipal: string }) {
  let sequencia = 0
  const novoId = (prefixo: string) => `${prefixo}_${String(++sequencia).padStart(6, '0')}`

  const contas = new Map<string, { chave: string; escrow: boolean }>()
  const chaves = new Map<string, string>()
  const clientes = new Map<string, { id: string; conta: string; externalReference: string }>()
  const tokens = new Map<string, string>()
  const pagamentos = new Map<string, Pagamento>()
  const estornos = new Map<string, { value: number; status: string }[]>()
  const escrows = new Map<string, { id: string; status: string; pagamento: string }>()
  const requisicoes: Requisicao[] = []

  const responder = (status: number, corpo: unknown) =>
    new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })
  const erro = (status: number, description: string) =>
    responder(status, { errors: [{ code: 'invalid_action', description }] })
  const reais = (v: number) => Math.round(v * 100) / 100

  const fetchDeMentira: typeof fetch = async (entrada, init) => {
    const url = new URL(String(entrada))
    const caminho = url.pathname.replace(/^\/v3/, '')
    const metodo = (init?.method ?? 'GET').toUpperCase()
    const headers = Object.fromEntries(
      Object.entries((init?.headers ?? {}) as Record<string, string>).map(([k, v]) => [
        k.toLowerCase(),
        v,
      ]),
    )
    const corpo = init?.body
      ? (JSON.parse(String(init.body)) as Record<string, unknown>)
      : undefined
    requisicoes.push({ metodo, caminho: caminho + url.search, headers, corpo })

    const chave = headers['access_token']
    if (!chave) return erro(401, 'access_token ausente')
    const contaDaChave = chaves.get(chave)

    // Subcontas: só com a chave principal.
    if (metodo === 'POST' && caminho === '/accounts') {
      if (chave !== config.chavePrincipal) return erro(401, 'Chave sem permissão')
      if (!corpo?.cpfCnpj) return erro(400, 'O CPF/CNPJ é obrigatório.')
      const id = novoId('acc')
      const apiKey = `$aact_${novoId('key')}`
      contas.set(id, { chave: apiKey, escrow: false })
      chaves.set(apiKey, id)
      return responder(200, { object: 'account', id, walletId: novoId('wal'), apiKey })
    }
    const escrowConta = caminho.match(/^\/accounts\/([^/]+)\/escrow$/)
    if (metodo === 'POST' && escrowConta) {
      const conta = contas.get(escrowConta[1] ?? '')
      if (chave !== config.chavePrincipal || !conta) return erro(404, 'Conta não encontrada')
      conta.escrow = true
      return responder(200, { enabled: true })
    }

    if (!contaDaChave) return erro(401, 'Chave inválida')

    if (caminho === '/customers' && metodo === 'GET') {
      const ref = url.searchParams.get('externalReference')
      const data = [...clientes.values()].filter(
        (c) => c.conta === contaDaChave && c.externalReference === ref,
      )
      return responder(200, { data: data.map((c) => ({ object: 'customer', id: c.id })) })
    }
    if (caminho === '/customers' && metodo === 'POST') {
      const id = novoId('cus')
      clientes.set(id, {
        id,
        conta: contaDaChave,
        externalReference: String(corpo?.externalReference ?? ''),
      })
      return responder(200, { object: 'customer', id })
    }

    if (caminho === '/creditCard/tokenize' && metodo === 'POST') {
      const cartao = corpo?.creditCard as { number?: string } | undefined
      const titular = corpo?.creditCardHolderInfo as
        { cpfCnpj?: string; postalCode?: string } | undefined
      if (!titular?.cpfCnpj || !titular.postalCode)
        return erro(400, 'Dados do titular incompletos.')
      const token = crypto.randomUUID()
      tokens.set(token, cartao?.number ?? '')
      return responder(200, {
        creditCardNumber: (cartao?.number ?? '').slice(-4),
        creditCardBrand: 'VISA',
        creditCardToken: token,
      })
    }

    if (caminho === '/payments' && metodo === 'GET') {
      const ref = url.searchParams.get('externalReference')
      const data = [...pagamentos.values()].filter(
        (p) => p.conta === contaDaChave && p.externalReference === ref,
      )
      return responder(200, { data })
    }
    if (caminho === '/payments' && metodo === 'POST') {
      const value = Number(corpo?.value)
      if (!(value > 0)) return erro(400, 'Valor inválido.')
      const ehCartao = corpo?.billingType === 'CREDIT_CARD'
      if (ehCartao && tokens.get(String(corpo?.creditCardToken)) === CARTAO_RECUSADO_DE_MENTIRA) {
        return erro(
          400,
          'Transação não autorizada. Verifique os dados do cartão ou entre em contato com o emissor.',
        )
      }
      const pagamento: Pagamento = {
        object: 'payment',
        id: novoId('pay'),
        customer: String(corpo?.customer),
        status: ehCartao ? 'AUTHORIZED' : 'PENDING',
        value,
        netValue: value,
        billingType: ehCartao ? 'CREDIT_CARD' : 'PIX',
        externalReference: (corpo?.externalReference as string | undefined) ?? null,
        confirmedDate: null,
        deleted: false,
        conta: contaDaChave,
      }
      pagamentos.set(pagamento.id, pagamento)
      estornos.set(pagamento.id, [])
      if (contas.get(contaDaChave)?.escrow) {
        escrows.set(pagamento.id, { id: novoId('esc'), status: 'ACTIVE', pagamento: pagamento.id })
      }
      return responder(200, pagamento)
    }

    if (caminho === '/transfers' && metodo === 'POST') {
      if (!(Number(corpo?.value) > 0)) return erro(400, 'Valor inválido.')
      if (!corpo?.pixAddressKey || !corpo.pixAddressKeyType)
        return erro(400, 'Chave Pix obrigatória.')
      return responder(200, { object: 'transfer', id: crypto.randomUUID(), status: 'PENDING' })
    }

    const rota = caminho.match(/^\/payments\/([^/]+)(\/[A-Za-z]+)?$/)
    const finalizarEscrow = caminho.match(/^\/escrow\/([^/]+)\/finish$/)
    const confirmarSandbox = caminho.match(/^\/sandbox\/payment\/([^/]+)\/confirm$/)

    if (finalizarEscrow && metodo === 'POST') {
      const escrow = [...escrows.values()].find((e) => e.id === finalizarEscrow[1])
      if (!escrow) return erro(404, 'Garantia não encontrada')
      escrow.status = 'DONE'
      return responder(200, { id: escrow.id, status: 'DONE' })
    }
    if (confirmarSandbox && metodo === 'POST') {
      const pagamento = pagamentos.get(confirmarSandbox[1] ?? '')
      if (!pagamento) return erro(404, 'Cobrança não encontrada')
      pagamento.status = 'RECEIVED'
      pagamento.confirmedDate = new Date().toISOString().slice(0, 10)
      return responder(200, pagamento)
    }

    if (!rota) return erro(404, `Rota desconhecida: ${metodo} ${caminho}`)
    const pagamento = pagamentos.get(rota[1] ?? '')
    if (!pagamento || pagamento.conta !== contaDaChave) return erro(404, 'Cobrança não encontrada')
    const acao = rota[2]

    if (!acao && metodo === 'GET') return responder(200, pagamento)
    if (!acao && metodo === 'DELETE') {
      pagamento.deleted = true
      return responder(200, { deleted: true, id: pagamento.id })
    }
    if (acao === '/pixQrCode' && metodo === 'GET') {
      return responder(200, {
        encodedImage:
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        payload: `00020101021226820014br.gov.bcb.pix2560qrpix.asaas.com/${pagamento.id}5204000053039865802BR`,
        expirationDate: '2026-12-31 23:59:59',
      })
    }
    if (acao === '/captureAuthorizedPayment' && metodo === 'POST') {
      if (pagamento.status !== 'AUTHORIZED') return erro(400, 'Cobrança não está autorizada.')
      pagamento.status = 'CONFIRMED'
      pagamento.confirmedDate = new Date().toISOString().slice(0, 10)
      pagamento.netValue = reais(pagamento.value - (pagamento.value * 0.0299 + 0.49))
      return responder(200, pagamento)
    }
    if (acao === '/refund' && metodo === 'POST') {
      const lista = estornos.get(pagamento.id) ?? []
      const jaEstornado = lista.reduce((t, e) => t + e.value, 0)
      const valor =
        corpo?.value === undefined ? reais(pagamento.value - jaEstornado) : Number(corpo.value)
      if (pagamento.status === 'AUTHORIZED') {
        pagamento.status = 'REFUNDED'
        return responder(200, pagamento)
      }
      if (valor > reais(pagamento.value - jaEstornado))
        return erro(400, 'Valor maior que o disponível.')
      lista.push({ value: valor, status: 'DONE' })
      if (reais(jaEstornado + valor) >= pagamento.value) pagamento.status = 'REFUNDED'
      return responder(200, pagamento)
    }
    if (acao === '/refunds' && metodo === 'GET') {
      return responder(200, { data: estornos.get(pagamento.id) ?? [] })
    }
    if (acao === '/escrow' && metodo === 'GET') {
      const escrow = escrows.get(pagamento.id)
      return escrow ? responder(200, escrow) : erro(404, 'Cobrança sem garantia')
    }
    return erro(404, `Rota desconhecida: ${metodo} ${caminho}`)
  }

  return {
    fetch: fetchDeMentira,
    requisicoes,
    chaveDaSubconta(subcontaId: string): string {
      const conta = contas.get(subcontaId)
      if (!conta) throw new Error(`Subconta ${subcontaId} não existe no servidor de mentira`)
      return conta.chave
    },
    confirmarPix(cobrancaId: string): void {
      const pagamento = pagamentos.get(cobrancaId)
      if (!pagamento) throw new Error(`Cobrança ${cobrancaId} não existe`)
      pagamento.status = 'RECEIVED'
      pagamento.confirmedDate = new Date().toISOString().slice(0, 10)
    },
  }
}
