import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { linkDoWhatsapp } from '@/lib/agenda'
import { simulacaoDePixLigada } from '@/server/dev'
import { barbeariaPublica } from '../../dados'
import { AcompanharAgendamento } from './acompanhar'

// Cliente 11 (Pix aguardando) e 12 (sucesso) na web, com a variação Reservado do cartão
// (backlog 12) e o Pix expirado.
export const metadata: Metadata = { title: 'Seu agendamento · Navalha', robots: { index: false } }

export default async function Agendamento({ params }: PageProps<'/[slug]/agendamento/[id]'>) {
  const { slug, id } = await params
  const pagina = await barbeariaPublica(slug)
  if (!pagina) notFound()
  return (
    <AcompanharAgendamento
      id={id}
      barbearia={{
        slug: pagina.slug,
        nome: pagina.nome,
        fuso: pagina.fuso,
        endereco: [pagina.endereco, pagina.bairro, pagina.cidade].filter(Boolean).join(', '),
        whatsapp: linkDoWhatsapp(pagina.whatsapp, `Olá! Tenho um agendamento na ${pagina.nome}.`),
      }}
      podeSimularPix={simulacaoDePixLigada()}
      lojas={{
        appStore: process.env.NEXT_PUBLIC_APP_STORE_URL ?? null,
        playStore: process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? null,
      }}
    />
  )
}
