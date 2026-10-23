// Erro de regra de negócio, com o status HTTP que a API devolve e uma mensagem para o usuário.

export type CodigoErro =
  | 'nao_autenticado'
  | 'nao_encontrado'
  | 'sem_permissao'
  | 'estado_invalido'
  | 'dados_invalidos'
  | 'horario_indisponivel'
  | 'cartao_recusado'
  | 'recebimentos_inativos'

const STATUS: Record<CodigoErro, number> = {
  nao_autenticado: 401,
  nao_encontrado: 404,
  sem_permissao: 403,
  estado_invalido: 409,
  dados_invalidos: 400,
  horario_indisponivel: 409,
  cartao_recusado: 402,
  recebimentos_inativos: 409,
}

export class ErroDeNegocio extends Error {
  readonly status: number

  constructor(
    readonly codigo: CodigoErro,
    mensagem: string,
  ) {
    super(mensagem)
    this.name = 'ErroDeNegocio'
    this.status = STATUS[codigo]
  }
}
