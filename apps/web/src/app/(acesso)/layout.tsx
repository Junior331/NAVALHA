import Link from 'next/link'
import type { ReactNode } from 'react'
import { Logo } from '@/componentes/logo'
import s from './acesso.module.css'

// Layout das telas de acesso (Figma Acessos: Login, Senha, Cadastro).
export default function LayoutDeAcesso({ children }: { children: ReactNode }) {
  return (
    <div className={s.pagina}>
      <aside className={s.marca}>
        <Link href="/" className={s.logo}>
          <Logo tamanho={32} />
          Navalha
        </Link>
        <div>
          <h2>Agenda cheia, sem falta e sem calote.</h2>
          <p>
            Agendamento online com pagamento antecipado e cancelamento com regra clara para a
            barbearia e para o cliente.
          </p>
        </div>
        <p className="rotulo">acesso seguro por código</p>
      </aside>
      <main className={s.conteudo}>{children}</main>
    </div>
  )
}
