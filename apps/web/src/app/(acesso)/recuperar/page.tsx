'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { Botao, BotaoLink, Campo, Mensagem } from '@/componentes/ui'
import { supabaseNoNavegador } from '@/lib/supabase'
import s from '../acesso.module.css'

// Figma Acessos · Esqueci a senha (código): 01 e-mail → 02 código → 03 inválido → 04 nova senha
// → 05 sucesso.
type Passo = 'email' | 'codigo' | 'senha' | 'pronto'

export default function Pagina() {
  const [passo, setPasso] = useState<Passo>('email')
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const supabase = supabaseNoNavegador()

  async function enviarCodigo(evento?: FormEvent) {
    evento?.preventDefault()
    setEnviando(true)
    setErro(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    setEnviando(false)
    if (error) return setErro('Não foi possível enviar o código. Confira o e-mail e tente de novo.')
    setPasso('codigo')
  }

  async function validarCodigo(evento: FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    setErro(null)
    const { error } = await supabase.auth.verifyOtp({ email, token: codigo, type: 'recovery' })
    setEnviando(false)
    if (error) return setErro('Código inválido ou vencido. Confira os 6 dígitos ou peça um novo.')
    setPasso('senha')
  }

  async function salvarSenha(evento: FormEvent) {
    evento.preventDefault()
    if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.')
    if (senha !== confirmacao) return setErro('As senhas não são iguais.')
    setEnviando(true)
    setErro(null)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setEnviando(false)
    if (error) return setErro('Não foi possível salvar a nova senha. Tente de novo.')
    setPasso('pronto')
  }

  if (passo === 'pronto') {
    return (
      <div className={s.formulario}>
        <h1>Senha redefinida</h1>
        <p className={s.subtitulo}>Você já está conectado com a nova senha.</p>
        <BotaoLink href="/painel" largo>
          Ir para o painel
        </BotaoLink>
      </div>
    )
  }

  return (
    <form
      className={s.formulario}
      onSubmit={passo === 'email' ? enviarCodigo : passo === 'codigo' ? validarCodigo : salvarSenha}
      noValidate
    >
      <div>
        <h1>{passo === 'senha' ? 'Crie uma nova senha' : 'Esqueci a senha'}</h1>
        <p className={s.subtitulo}>
          {passo === 'email'
            ? 'Enviamos um código de 6 dígitos para o seu e-mail.'
            : passo === 'codigo'
              ? `Digite o código enviado para ${email}.`
              : 'Mínimo de 8 caracteres.'}
        </p>
      </div>

      {passo === 'email' ? (
        <Campo
          rotulo="E-mail"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      ) : null}
      {passo === 'codigo' ? (
        <Campo
          rotulo="Código"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          className={s.codigo}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
        />
      ) : null}
      {passo === 'senha' ? (
        <div className={s.linhas}>
          <Campo
            rotulo="Nova senha"
            type="password"
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
          <Campo
            rotulo="Confirmar senha"
            type="password"
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
          />
        </div>
      ) : null}

      {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
      <Botao
        type="submit"
        largo
        grande
        disabled={
          enviando ||
          (passo === 'email' && !email) ||
          (passo === 'codigo' && codigo.length !== 6) ||
          (passo === 'senha' && (!senha || !confirmacao))
        }
      >
        {passo === 'email'
          ? 'Enviar código'
          : passo === 'codigo'
            ? 'Validar código'
            : 'Salvar senha'}
      </Botao>
      <div className={s.rodape}>
        <Link href="/entrar">Voltar para o login</Link>
        {passo === 'codigo' ? (
          <button
            type="button"
            className="mono"
            onClick={() => enviarCodigo()}
            style={{
              background: 'none',
              border: 0,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Reenviar código
          </button>
        ) : null}
      </div>
    </form>
  )
}
