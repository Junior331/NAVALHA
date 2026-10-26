import QRCode from 'qrcode'
import { Mensagem } from '@/componentes/ui'
import { barbeariaDoPainel } from '@/lib/painel'
import { situacaoDoHorario } from '../../[slug]/dados'
import s from '../painel.module.css'
import { EditorDoPerfil } from './editor'

// Figma Admin 09 · Perfil da barbearia: identidade visual, dados públicos, prévia no app do
// cliente e visibilidade. Backlog 09: o interruptor de agendamentos online depende de ativar os
// recebimentos e pede confirmação para desligar; um jeito só de salvar.
export default async function Perfil() {
  const { supabase, barbearia, papel } = await barbeariaDoPainel()
  const [dados, horarios, avaliacoes] = await Promise.all([
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
    supabase.from('avaliacoes').select('nota').eq('barbearia_id', barbearia.id),
  ])
  const link = `${process.env.NEXT_PUBLIC_URL_PUBLICA ?? 'http://localhost:3000'}/${barbearia.slug}`
  const qrCode = await QRCode.toDataURL(link, {
    margin: 1,
    width: 512,
    color: { dark: '#16130f', light: '#ffffff' },
  })
  const grade = (horarios.data ?? []).map((h) => ({
    dia: h.dia_semana,
    abre: h.abre.slice(0, 5),
    fecha: h.fecha.slice(0, 5),
  }))
  const notas = (avaliacoes.data ?? []).map((a) => a.nota)

  if (papel !== 'dono' || !dados.data) {
    return (
      <>
        <div className={s.cabecalhoPagina}>
          <div>
            <h1>Perfil da barbearia</h1>
            <p>Como sua barbearia aparece para os clientes no app</p>
          </div>
        </div>
        <Mensagem tipo="info">Só o dono da barbearia altera o perfil.</Mensagem>
      </>
    )
  }

  return (
    <EditorDoPerfil
      barbeariaId={barbearia.id}
      slug={barbearia.slug}
      link={link}
      qrCode={qrCode}
      recebimentosAtivos={barbearia.recebimentos_ativos_em !== null}
      aceitarOnline={barbearia.aceitar_agendamentos_online}
      aparecerNasBuscas={dados.data.aparecer_nas_buscas}
      avaliacao={{
        media: notas.length ? notas.reduce((t, n) => t + n, 0) / notas.length : null,
        total: notas.length,
      }}
      situacao={situacaoDoHorario({
        fuso: barbearia.fuso,
        horarios: grade.map((h) => ({ diaSemana: h.dia, abre: h.abre, fecha: h.fecha })),
      })}
      inicial={{
        nome: dados.data.nome,
        descricao: dados.data.descricao ?? '',
        whatsapp: dados.data.whatsapp ?? '',
        instagram: dados.data.instagram ?? '',
        endereco: dados.data.endereco ?? '',
        bairro: dados.data.bairro ?? '',
        cidade: dados.data.cidade ?? '',
        uf: dados.data.uf ?? '',
        capaUrl: dados.data.capa_url,
        logoUrl: dados.data.logo_url,
      }}
      horarios={grade}
    />
  )
}
