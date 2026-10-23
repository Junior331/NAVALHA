import { Mensagem } from '@/componentes/ui'
import { barbeariaDoPainel } from '@/lib/painel'
import c from '../conta.module.css'
import s from '../painel.module.css'
import { FormularioDeFidelidade, FormularioDePolitica } from './formularios'

// Configurações (tela nova, regras-de-negocio §Telas que mudam): política de cancelamento e
// fidelidade.
export default async function Configuracoes() {
  const { supabase, barbearia, papel } = await barbeariaDoPainel()
  const [politica, fidelidade, servicos] = await Promise.all([
    supabase
      .from('politicas_cancelamento')
      .select('prazo_gratis_horas, retencao_pct, tolerancia_min')
      .eq('barbearia_id', barbearia.id)
      .maybeSingle(),
    supabase
      .from('fidelidade_config')
      .select('ativa, cortes_necessarios, servico_gratis_id')
      .eq('barbearia_id', barbearia.id)
      .maybeSingle(),
    supabase
      .from('servicos')
      .select('id, nome')
      .eq('barbearia_id', barbearia.id)
      .eq('ativo', true)
      .order('ordem'),
  ])

  return (
    <div className={c.coluna}>
      <div className={s.cabecalhoPagina}>
        <div>
          <h1>Configurações</h1>
          <p>Regras que valem para os agendamentos novos da barbearia.</p>
        </div>
      </div>
      {papel !== 'dono' ? (
        <Mensagem tipo="info">Só o dono da barbearia altera as configurações.</Mensagem>
      ) : (
        <>
          <FormularioDePolitica
            barbeariaId={barbearia.id}
            inicial={{
              prazoGratisHoras: Number(politica.data?.prazo_gratis_horas ?? 2),
              retencaoPct: politica.data?.retencao_pct ?? 50,
              toleranciaMin: politica.data?.tolerancia_min ?? 15,
            }}
          />
          <FormularioDeFidelidade
            barbeariaId={barbearia.id}
            servicos={servicos.data ?? []}
            inicial={{
              ativa: fidelidade.data?.ativa ?? false,
              cortes: fidelidade.data?.cortes_necessarios ?? 5,
              servicoGratisId: fidelidade.data?.servico_gratis_id ?? '',
            }}
          />
        </>
      )}
    </div>
  )
}
