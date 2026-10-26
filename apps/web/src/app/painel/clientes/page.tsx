import { partesLocais } from '@navalha/core'
import Link from 'next/link'
import { Paginacao, paginaDaUrl } from '@/componentes/paginacao'
import { Avatar, Vazio } from '@/componentes/ui'
import t from '@/componentes/tabela.module.css'
import { linkDoWhatsapp } from '@/lib/agenda'
import { dataCurta, hora, reais } from '@/lib/formato'
import { barbeariaDoPainel } from '@/lib/painel'
import { ATIVOS } from '@/lib/status'
import s from '../painel.module.css'

// Clientes (menu Geral do Figma Admin): quem já agendou na barbearia, com visitas, gasto,
// último atendimento e próximo horário. ?q= busca por nome ou celular (a busca do topo cai aqui).

interface Resumo {
  id: string
  nome: string
  celular: string | null
  visitas: number
  noShows: number
  gastoCentavos: number
  ultimo: string | null
  proximo: string | null
}

const semAcento = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const POR_PAGINA = 25

export default async function Clientes({ searchParams }: PageProps<'/painel/clientes'>) {
  const parametros = await searchParams
  const termo = typeof parametros.q === 'string' ? parametros.q.trim() : ''
  const { supabase, barbearia } = await barbeariaDoPainel()
  const fuso = barbearia.fuso
  const agora = new Date()

  const { data } = await supabase
    .from('agendamentos')
    .select('inicio, status, valor_pago_centavos, cliente_id, clientes(nome, celular)')
    .eq('barbearia_id', barbearia.id)
    .neq('status', 'liberado')
    .order('inicio', { ascending: false })
    .limit(5000)

  const porCliente = new Map<string, Resumo>()
  for (const a of data ?? []) {
    const atual = porCliente.get(a.cliente_id) ?? {
      id: a.cliente_id,
      nome: a.clientes?.nome ?? 'Cliente',
      celular: a.clientes?.celular ?? null,
      visitas: 0,
      noShows: 0,
      gastoCentavos: 0,
      ultimo: null,
      proximo: null,
    }
    if (a.status === 'concluido') {
      atual.visitas += 1
      atual.gastoCentavos += a.valor_pago_centavos
      if (!atual.ultimo || a.inicio > atual.ultimo) atual.ultimo = a.inicio
    }
    if (a.status === 'no_show') atual.noShows += 1
    if (
      ATIVOS.includes(a.status) &&
      new Date(a.inicio) >= agora &&
      (!atual.proximo || a.inicio < atual.proximo)
    )
      atual.proximo = a.inicio
    porCliente.set(a.cliente_id, atual)
  }

  const busca = semAcento(termo)
  const digitos = termo.replace(/\D/g, '')
  const clientes = [...porCliente.values()]
    .filter(
      (c) =>
        !termo ||
        semAcento(c.nome).includes(busca) ||
        (digitos.length >= 3 && (c.celular ?? '').replace(/\D/g, '').includes(digitos)),
    )
    .sort(
      (a, b) =>
        (b.proximo ? 1 : 0) - (a.proximo ? 1 : 0) || (b.ultimo ?? '').localeCompare(a.ultimo ?? ''),
    )
  const pagina = Math.min(
    paginaDaUrl(parametros.pagina),
    Math.max(1, Math.ceil(clientes.length / POR_PAGINA)),
  )
  const daPagina = clientes.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)
  const endereco = (p: number) => {
    const busca = new URLSearchParams()
    if (termo) busca.set('q', termo)
    if (p > 1) busca.set('pagina', String(p))
    return `/painel/clientes${busca.size ? `?${busca.toString()}` : ''}`
  }

  return (
    <>
      <div className={s.cabecalhoPagina}>
        <div>
          <h1>Clientes</h1>
          <p>
            {porCliente.size} {porCliente.size === 1 ? 'cliente' : 'clientes'} · quem já agendou na
            barbearia
          </p>
        </div>
      </div>

      <section className={t.envoltorio} aria-labelledby="titulo-clientes">
        <div className={t.ferramentas}>
          <h2 id="titulo-clientes" className="so-leitor">
            Lista de clientes
          </h2>
          <form role="search" action="/painel/clientes">
            <input
              className={t.busca}
              type="search"
              name="q"
              defaultValue={termo}
              placeholder="Nome ou celular"
              aria-label="Buscar cliente por nome ou celular"
            />
          </form>
          {termo ? (
            <span className={t.secundario}>
              {clientes.length} {clientes.length === 1 ? 'resultado' : 'resultados'} para “{termo}”
              · <Link href="/painel/clientes">limpar</Link>
            </span>
          ) : null}
        </div>
        {clientes.length === 0 ? (
          <div style={{ padding: 16 }}>
            <Vazio titulo={termo ? 'Nenhum cliente encontrado' : 'Ainda sem clientes'}>
              <p>Os clientes aparecem aqui depois do primeiro agendamento.</p>
            </Vazio>
          </div>
        ) : (
          <table className={t.tabela}>
            <thead>
              <tr>
                <th scope="col">Cliente</th>
                <th scope="col">Visitas</th>
                <th scope="col">Último atendimento</th>
                <th scope="col">Próximo horário</th>
                <th scope="col">Total gasto</th>
                <th scope="col">No-shows</th>
                <th scope="col">
                  <span className="so-leitor">Contato</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {daPagina.map((c) => {
                const whatsapp = linkDoWhatsapp(
                  c.celular,
                  `Olá, ${c.nome.split(' ')[0]}! Aqui é da ${barbearia.nome}.`,
                )
                return (
                  <tr key={c.id}>
                    <td>
                      <span className={t.pessoa}>
                        <Avatar nome={c.nome} tamanho={36} />
                        <span>
                          <strong style={{ fontWeight: 500 }}>{c.nome}</strong>
                          <span className={t.secundario}>{c.celular ?? 'Sem celular'}</span>
                        </span>
                      </span>
                    </td>
                    <td className={t.numero}>{c.visitas}</td>
                    <td>{c.ultimo ? dataCurta(c.ultimo, fuso) : '—'}</td>
                    <td>
                      {c.proximo ? (
                        <Link
                          href={`/painel/agenda?data=${partesLocais(new Date(c.proximo), fuso).data}&visao=dia`}
                          className={t.numero}
                        >
                          {dataCurta(c.proximo, fuso)}, {hora(c.proximo, fuso)}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={t.numero}>{reais(c.gastoCentavos)}</td>
                    <td className={t.numero}>{c.noShows}</td>
                    <td>
                      {whatsapp ? (
                        <a href={whatsapp} target="_blank" rel="noreferrer">
                          WhatsApp
                        </a>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {clientes.length > 0 ? (
          <Paginacao
            pagina={pagina}
            porPagina={POR_PAGINA}
            total={clientes.length}
            endereco={endereco}
            rotulo="cadastro de clientes"
          />
        ) : null}
      </section>
    </>
  )
}
