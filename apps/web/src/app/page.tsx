import Link from 'next/link'
import { BotaoLink } from '@/componentes/ui'
import s from './inicio.module.css'

// Entrada do site. A página de cada barbearia fica em /<slug> (fase 7b).
export default function Inicio() {
  return (
    <main className={s.pagina}>
      <header className={s.topo}>
        <span className={s.logo}>
          <span className={s.icone} aria-hidden>
            ✂
          </span>
          Navalha
        </span>
        <nav className={s.links}>
          <Link href="/entrar">Entrar</Link>
          <BotaoLink href="/cadastro">Cadastrar barbearia</BotaoLink>
        </nav>
      </header>
      <section className={s.heroi}>
        <p className="rotulo">Agendamento com pagamento antecipado</p>
        <h1>A agenda da barbearia cheia, sem falta e sem calote.</h1>
        <p>
          O cliente agenda e paga na hora, por Pix ou cartão. Se cancelar fora do prazo ou não
          aparecer, a barbearia recebe a parte combinada. Tudo no automático.
        </p>
        <div className={s.acoes}>
          <BotaoLink href="/cadastro">Começar grátis</BotaoLink>
          <BotaoLink href="/laboratorio" variante="secundario">
            Ver as regras funcionando
          </BotaoLink>
        </div>
      </section>
    </main>
  )
}
