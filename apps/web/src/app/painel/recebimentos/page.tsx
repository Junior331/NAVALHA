import { consultarCarteira } from '@navalha/servidor'
import { BotaoLink, Cartao, Mensagem } from '@/componentes/ui'
import { dataLonga } from '@/lib/formato'
import { barbeariaDoPainel } from '@/lib/painel'
import { contexto } from '@/server/contexto'
import c from '../conta.module.css'
import s from '../painel.module.css'
import { AtivacaoDoPainel } from './ativacao'

// Ativar recebimentos (estado novo, backlog Admin): antes disso a barbearia configura tudo, mas
// não recebe agendamentos pagos (ajustes-taxas §Subconta).
export default async function Recebimentos() {
  const { supabase, barbearia, papel, usuarioId } = await barbeariaDoPainel()
  const { data: claims } = await supabase.auth.getClaims()
  const email = typeof claims?.claims.email === 'string' ? claims.claims.email : ''

  return (
    <div className={c.coluna}>
      <div className={s.cabecalhoPagina}>
        <div>
          <h1>Ativar recebimentos</h1>
          <p>Para receber Pix e cartão dos agendamentos online.</p>
        </div>
      </div>
      {barbearia.recebimentos_ativos_em && papel === 'dono' ? (
        <>
          <Mensagem tipo="sucesso">
            Recebimentos ativos desde {dataLonga(barbearia.recebimentos_ativos_em, barbearia.fuso)}.
            A sua página aceita agendamentos pagos.
          </Mensagem>
          {(await consultarCarteira(contexto(), { id: usuarioId, anonimo: false }, barbearia.id))
            .cadastroAprovado ? null : (
            <Mensagem tipo="info">
              O Asaas está analisando o cadastro e vai pedir os documentos por e-mail. Os saques
              liberam depois da aprovação; os agendamentos já podem ser pagos.
            </Mensagem>
          )}
          <div className={c.acoes} style={{ justifyContent: 'flex-start' }}>
            <BotaoLink href="/painel/financeiro">Ir para o Financeiro</BotaoLink>
            <BotaoLink href="/painel/perfil" variante="secundario">
              Ver o perfil da barbearia
            </BotaoLink>
          </div>
        </>
      ) : barbearia.recebimentos_ativos_em ? (
        <Mensagem tipo="sucesso">Os recebimentos da barbearia estão ativos.</Mensagem>
      ) : papel !== 'dono' ? (
        <Mensagem tipo="info">Só o dono da barbearia ativa os recebimentos.</Mensagem>
      ) : (
        <>
          <Cartao>
            <div className={c.explicacao}>
              <p>
                A Navalha abre uma conta de pagamentos no Asaas em nome da barbearia. Como funciona:
              </p>
              <ul>
                <li>O cliente paga ao agendar, e o valor fica retido até o atendimento.</li>
                <li>
                  Depois do atendimento, o valor é liberado já sem as taxas e pode ser sacado por
                  Pix, a partir de R$ 50.
                </li>
                <li>Cancelamentos e no-show seguem a política que você define em Configurações.</li>
              </ul>
            </div>
          </Cartao>
          <Cartao>
            <AtivacaoDoPainel barbeariaId={barbearia.id} emailInicial={email} />
          </Cartao>
        </>
      )}
    </div>
  )
}
