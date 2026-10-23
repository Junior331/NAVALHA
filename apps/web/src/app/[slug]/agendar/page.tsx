import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { partesLocais } from '@navalha/core'
import { barbeariaPublica } from '../dados'
import v from '../vitrine.module.css'
import { FluxoDeAgendamento } from './fluxo'

// Fluxo de agendamento na web (versão responsiva das Cliente 07–10), sem baixar o app: o
// checkout pede só nome, celular e e-mail (cadastro leve, roadmap 7b).

export async function generateMetadata({
  params,
}: PageProps<'/[slug]/agendar'>): Promise<Metadata> {
  const pagina = await barbeariaPublica((await params).slug)
  return { title: pagina ? `Agendar · ${pagina.nome}` : 'Agendar · Navalha' }
}

export default async function Agendar({ params, searchParams }: PageProps<'/[slug]/agendar'>) {
  const pagina = await barbeariaPublica((await params).slug)
  if (!pagina) notFound()
  const consulta = await searchParams
  const pedidos = typeof consulta.servicos === 'string' ? consulta.servicos.split(',') : []
  const servicosIniciais = pedidos.filter((id) => pagina.servicos.some((s) => s.id === id))

  if (!pagina.aceitaAgendamentos) {
    return (
      <main className={v.conteudo} style={{ marginTop: 40 }}>
        <h1>{pagina.nome}</h1>
        <p className={v.aviso} role="status">
          Os agendamentos online estão pausados nesta barbearia.
        </p>
        <Link href={`/${pagina.slug}`}>Voltar para a página da barbearia</Link>
      </main>
    )
  }

  return (
    <FluxoDeAgendamento
      pagina={pagina}
      servicosIniciais={servicosIniciais}
      hoje={partesLocais(new Date(), pagina.fuso).data}
    />
  )
}
