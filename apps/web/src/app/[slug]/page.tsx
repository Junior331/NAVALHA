import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Logo } from '@/componentes/logo'
import { linkDoWhatsapp } from '@/lib/agenda'
import { barbeariaPublica, situacaoDoHorario } from './dados'
import { EscolhaDeServicos } from './servicos'
import v from './vitrine.module.css'

// Página pública da barbearia (navalha.app/<slug>): versão web da Cliente 03, para agendar sem
// baixar o app (roadmap 7b). Renderizada no servidor, com metadados para busca e compartilhamento.

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export async function generateMetadata({ params }: PageProps<'/[slug]'>): Promise<Metadata> {
  const pagina = await barbeariaPublica((await params).slug)
  if (!pagina) return { title: 'Barbearia não encontrada · Navalha' }
  const descricao =
    pagina.descricao ?? `Agende seu horário na ${pagina.nome} pelo Navalha, com pagamento online.`
  return {
    title: `${pagina.nome} · Agende pelo Navalha`,
    description: descricao,
    openGraph: {
      title: pagina.nome,
      description: descricao,
      ...(pagina.capaUrl ? { images: [pagina.capaUrl] } : {}),
    },
  }
}

export default async function PaginaPublica({ params }: PageProps<'/[slug]'>) {
  const pagina = await barbeariaPublica((await params).slug)
  if (!pagina) notFound()

  const endereco = [pagina.endereco, pagina.bairro, pagina.cidade, pagina.uf]
    .filter(Boolean)
    .join(', ')
  const whatsapp = linkDoWhatsapp(pagina.whatsapp, `Olá! Vi a ${pagina.nome} no Navalha.`)
  const mapa = endereco
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${pagina.nome}, ${endereco}`)}`
    : null
  const { politica } = pagina

  return (
    <div className={v.pagina}>
      <header
        className={v.capa}
        style={pagina.capaUrl ? { backgroundImage: `url(${pagina.capaUrl})` } : undefined}
      >
        <Link href="/" className={v.marca}>
          <Logo tamanho={18} />
          Navalha
        </Link>
      </header>

      <main className={v.conteudo}>
        <section className={v.identidade}>
          <span
            className={v.logo}
            style={pagina.logoUrl ? { backgroundImage: `url(${pagina.logoUrl})` } : undefined}
            aria-hidden="true"
          >
            {pagina.logoUrl ? '' : pagina.nome.slice(0, 1)}
          </span>
          <div>
            <h1>{pagina.nome}</h1>
            <p className={v.linhaInfo}>
              {pagina.nota !== null ? (
                <span>
                  ★ {pagina.nota.toLocaleString('pt-BR')} · {pagina.avaliacoes} avaliações
                </span>
              ) : (
                <span>Sem avaliações ainda</span>
              )}
              <span>{situacaoDoHorario(pagina)}</span>
            </p>
            {endereco ? <p className={v.endereco}>{endereco}</p> : null}
          </div>
        </section>

        <div className={v.atalhos}>
          {whatsapp ? (
            <a href={whatsapp} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          ) : null}
          {mapa ? (
            <a href={mapa} target="_blank" rel="noreferrer">
              Como chegar
            </a>
          ) : null}
          {pagina.instagram ? (
            <a
              href={`https://instagram.com/${pagina.instagram.replace(/^@/, '')}`}
              target="_blank"
              rel="noreferrer"
            >
              Instagram
            </a>
          ) : null}
        </div>

        {pagina.descricao ? <p className={v.descricao}>{pagina.descricao}</p> : null}

        {!pagina.aceitaAgendamentos ? (
          <p className={v.aviso} role="status">
            Os agendamentos online estão pausados nesta barbearia.
            {whatsapp ? ' Fale com a barbearia pelo WhatsApp.' : ''}
          </p>
        ) : null}

        <section aria-labelledby="titulo-servicos" className={v.secao}>
          <h2 id="titulo-servicos">Serviços</h2>
          <EscolhaDeServicos
            slug={pagina.slug}
            servicos={pagina.servicos}
            aceitaAgendamentos={pagina.aceitaAgendamentos}
          />
        </section>

        <section aria-labelledby="titulo-politica" className={v.secao}>
          <h2 id="titulo-politica">Cancelamento</h2>
          <p className={v.politica}>
            Grátis até {politica.prazoGratisHoras}h antes do horário. Depois disso, ou se você não
            vier, {politica.retencaoPct}% do valor fica com a barbearia
            {politica.retencaoPct < 100 ? ' e o resto volta para você' : ''}. Atrasos de até{' '}
            {politica.toleranciaMin} minutos são tolerados.
          </p>
        </section>

        {pagina.barbeiros.length > 0 ? (
          <section aria-labelledby="titulo-equipe" className={v.secao}>
            <h2 id="titulo-equipe">Equipe</h2>
            <ul className={v.equipe}>
              {pagina.barbeiros.map((b) => (
                <li key={b.id}>
                  <span className={v.avatar} aria-hidden="true">
                    {b.nome
                      .split(' ')
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join('')}
                  </span>
                  <span>
                    <strong>{b.nome}</strong>
                    <span className={v.suave}>
                      {b.nota !== null
                        ? `★ ${b.nota.toLocaleString('pt-BR')} · ${b.avaliacoes} avaliações`
                        : 'Novo na equipe'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {pagina.depoimentos.length > 0 ? (
          <section aria-labelledby="titulo-avaliacoes" className={v.secao}>
            <h2 id="titulo-avaliacoes">Avaliações</h2>
            <ul className={v.depoimentos}>
              {pagina.depoimentos.map((d, i) => (
                <li key={i}>
                  <span aria-label={`${d.nota} de 5 estrelas`}>{'★'.repeat(d.nota)}</span>
                  <p>{d.comentario}</p>
                  <span className={v.suave}>{d.cliente}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="titulo-horarios" className={v.secao}>
          <h2 id="titulo-horarios">Horário de funcionamento</h2>
          <dl className={v.horarios}>
            {[1, 2, 3, 4, 5, 6, 0].map((dia) => {
              const h = pagina.horarios.find((x) => x.diaSemana === dia)
              return (
                <div key={dia}>
                  <dt>{DIAS[dia]}</dt>
                  <dd>{h ? `${h.abre} às ${h.fecha}` : 'Fechado'}</dd>
                </div>
              )
            })}
          </dl>
        </section>
      </main>

      <footer className={v.rodape}>
        Agendamento e pagamento pelo <Link href="/">Navalha</Link>.
      </footer>
    </div>
  )
}
