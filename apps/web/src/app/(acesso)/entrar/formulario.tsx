'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Botao, Campo, Mensagem } from '@/componentes/ui'
import { supabaseNoNavegador } from '@/lib/supabase'
import s from '../acesso.module.css'

export function FormularioDeEntrada() {
  const router = useRouter()
  const voltar = useSearchParams().get('voltar') ?? '/painel'
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function entrar(evento: FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    setErro(null)
    const { error } = await supabaseNoNavegador().auth.signInWithPassword({
      email,
      password: senha,
    })
    setEnviando(false)
    if (error) {
      setErro(
        error.code === 'email_not_confirmed'
          ? 'Confirme seu e-mail antes de entrar. Enviamos um código na hora do cadastro.'
          : 'E-mail ou senha incorretos.',
      )
      return
    }
    router.replace(voltar.startsWith('/') ? voltar : '/painel')
    router.refresh()
  }

  return (
    <form className={s.formulario} onSubmit={entrar} noValidate>
      <div>
        <h1>Entrar</h1>
        <p className={s.subtitulo}>Painel da barbearia.</p>
      </div>
      <div className={s.linhas}>
        <Campo
          rotulo="E-mail"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Campo
          rotulo="Senha"
          type="password"
          autoComplete="current-password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
      </div>
      {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
      <Botao type="submit" largo grande disabled={enviando || !email || !senha}>
        {enviando ? 'Entrando…' : 'Entrar'}
      </Botao>
      <div className={s.rodape}>
        <Link href="/recuperar">Esqueci a senha</Link>
        <span>
          Novo por aqui? <Link href="/cadastro">Cadastrar barbearia</Link>
        </span>
      </div>
    </form>
  )
}
