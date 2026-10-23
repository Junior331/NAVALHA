import { Mensagem } from '@/componentes/ui'
import { barbeariaDoPainel } from '@/lib/painel'
import c from '../conta.module.css'
import s from '../painel.module.css'
import { EditorDoPerfil } from './editor'

// Figma Admin 09 · Perfil da barbearia: dados públicos, imagens, horário de funcionamento e
// visibilidade. Backlog 09: o interruptor de agendamentos online depende de ativar os
// recebimentos e pede confirmação para desligar; um jeito só de salvar.
export default async function Perfil() {
  const { supabase, barbearia, papel } = await barbeariaDoPainel()
  const [dados, horarios] = await Promise.all([
    supabase
      .from('barbearias')
      .select(
        'nome, descricao, telefone, whatsapp, instagram, endereco, bairro, cidade, uf, capa_url, logo_url, aparecer_nas_buscas',
      )
      .eq('id', barbearia.id)
      .single(),
    supabase
      .from('horarios_barbearia')
      .select('dia_semana, abre, fecha')
      .eq('barbearia_id', barbearia.id),
  ])

  return (
    <div className={c.coluna}>
      <div className={s.cabecalhoPagina}>
        <div>
          <h1>Perfil da barbearia</h1>
          <p>O que os clientes veem na página e no app.</p>
        </div>
        <a href={`/${barbearia.slug}`} target="_blank" rel="noreferrer">
          Ver página pública ↗
        </a>
      </div>
      {papel !== 'dono' || !dados.data ? (
        <Mensagem tipo="info">Só o dono da barbearia altera o perfil.</Mensagem>
      ) : (
        <EditorDoPerfil
          barbeariaId={barbearia.id}
          recebimentosAtivos={barbearia.recebimentos_ativos_em !== null}
          aceitarOnline={barbearia.aceitar_agendamentos_online}
          inicial={{
            nome: dados.data.nome,
            descricao: dados.data.descricao ?? '',
            telefone: dados.data.telefone ?? '',
            whatsapp: dados.data.whatsapp ?? '',
            instagram: dados.data.instagram ?? '',
            endereco: dados.data.endereco ?? '',
            bairro: dados.data.bairro ?? '',
            cidade: dados.data.cidade ?? '',
            uf: dados.data.uf ?? '',
            capaUrl: dados.data.capa_url,
            logoUrl: dados.data.logo_url,
          }}
          aparecerNasBuscas={dados.data.aparecer_nas_buscas}
          horarios={(horarios.data ?? []).map((h) => ({
            dia: h.dia_semana,
            abre: h.abre.slice(0, 5),
            fecha: h.fecha.slice(0, 5),
          }))}
        />
      )}
    </div>
  )
}
