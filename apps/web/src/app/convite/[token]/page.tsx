import type { Metadata } from 'next'
import Link from 'next/link'
import { consultarConvite, ErroDeNegocio } from '@navalha/servidor'
import { contexto } from '@/server/contexto'
import v from '../../[slug]/vitrine.module.css'

// Link do convite (Admin 04b) aberto no celular: o barbeiro usa o app, então a página abre o app
// pelo esquema navalha://. O link universal (abrir direto o app) entra com os IDs das lojas.
export const metadata: Metadata = {
  title: 'Convite para a equipe · Navalha',
  robots: { index: false },
}

export default async function Convite({ params }: PageProps<'/convite/[token]'>) {
  const { token } = await params
  const convite = await consultarConvite(contexto(), token).catch((erro: unknown) => {
    if (erro instanceof ErroDeNegocio) return null
    throw erro
  })

  return (
    <main className={v.conteudo} style={{ marginTop: 48 }}>
      {!convite ? (
        <>
          <h1>Convite não encontrado</h1>
          <p>Confira o link com quem convidou você.</p>
        </>
      ) : convite.expirado ? (
        <>
          <h1>Convite expirado</h1>
          <p>
            Este link já foi usado ou passou de 7 dias. Peça um novo ao dono da{' '}
            {convite.barbeariaNome}.
          </p>
        </>
      ) : (
        <>
          <h1>Olá, {convite.nome.split(' ')[0]}!</h1>
          <p>
            Você foi convidado para a equipe da <strong>{convite.barbeariaNome}</strong> no Navalha.
            A agenda do barbeiro fica no app.
          </p>
          <a className={v.botaoAgendar} href={`navalha://convite/${token}`}>
            Abrir no app Navalha
          </a>
          <p className={v.suave}>
            Ainda não tem o app? Instale o Navalha e abra este link de novo no celular.
          </p>
        </>
      )}
      <Link href="/">Conhecer o Navalha</Link>
    </main>
  )
}
