export type { ConfigServidor, Contexto, EventoInterno, Resultado } from './contexto'
export { ErroDeNegocio, type CodigoErro } from './erros'
export {
  NotificadorEmMemoria,
  NotificadorPadrao,
  type Aviso,
  type Canal,
  type Notificador,
} from './notificacoes'
export { carregarAgendamento, type AgendamentoCompleto } from './repositorio'
export {
  capturarAgendamento,
  liberarPorFaltaDeRegularizacao,
  preAutorizarAgendamento,
} from './servicos/cobranca-cartao'
export { liquidarAgendamento } from './servicos/liquidacao'
export { fecharLoteDaSemana } from './servicos/lote-semanal'
export {
  confirmarPixPago,
  expirarReserva,
  SUFIXO_REGULARIZACAO,
  type DadosReserva,
} from './servicos/pix'
export { enviarLembrete, marcarNoShowSeVencido } from './servicos/rotina'
export { processarWebhookDePagamento, registrarWebhook } from './servicos/webhook'
export { CanalEmailResend, CanalPushExpo } from './canais'
export { chaveDaSubcontaNoVault, montarContexto, type Ambiente } from './configuracao'
export {
  clienteDoUsuario,
  exigirDono,
  exigirMembro,
  papelNaBarbearia,
  type Papel,
  type Usuario,
} from './casos/acesso'
export {
  calcularPreco,
  criarAgendamento,
  simularPreco,
  type EntradaAgendamento,
  type SaidaAgendamento,
} from './casos/agendar'
export {
  cancelarAgendamento,
  concluirAtendimento,
  iniciarAtendimento,
  marcarNoShow,
  previaDoCancelamento,
  previaDoNoShow,
  type PreviaCancelamento,
} from './casos/atendimento'
export {
  aceitarConvite,
  cadastrarBarbearia,
  cadastrarCliente,
  consultarConvite,
  criarConvite,
  registrarDispositivo,
  type DadosBarbearia,
} from './casos/cadastro'
export { consultarDisponibilidade, type Disponibilidade } from './casos/disponibilidade'
export { agendamentosAfetados, pausarAgenda, removerBarbeiro } from './casos/equipe'
export {
  agendarNoBalcao,
  buscarClientes,
  horariosDaEquipe,
  horariosParaRemarcar,
  remarcarAgendamento,
  type EntradaBalcao,
} from './casos/agenda'
