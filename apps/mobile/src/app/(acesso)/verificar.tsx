import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Botao, Campo, Mensagem, Tela, Texto, Titulo } from '../../componentes/ui'
import { api, mensagemDe } from '../../lib/api'
import { registrarParaPush } from '../../lib/push'
import { useSessao } from '../../lib/sessao'
import { supabase } from '../../lib/supabase'

// Figma Mobile 08 · Código de 6 dígitos enviado por e-mail.
export default function Verificar() {
  const {
    email = '',
    nome = '',
    celular = '',
    convite,
  } = useLocalSearchParams<{
    email: string
    nome: string
    celular: string
    convite?: string
  }>()
  const { recarregar } = useSessao()
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [reenviado, setReenviado] = useState(false)

  async function confirmar() {
    setEnviando(true)
    setErro(null)
    const { error } = await supabase.auth.verifyOtp({ email, token: codigo, type: 'email' })
    if (error) {
      setEnviando(false)
      setErro('Código inválido ou vencido. Confira os 6 dígitos.')
      return
    }
    try {
      if (convite) {
        await api(`/api/convites/${convite}`, { metodo: 'POST', corpo: {} })
      } else {
        await api('/api/clientes', { corpo: { nome, ...(celular ? { celular } : {}), email } })
      }
      await recarregar()
      void registrarParaPush().catch(() => undefined)
      router.replace('/')
    } catch (e) {
      setErro(mensagemDe(e, 'Conta confirmada, mas não conseguimos terminar o cadastro.'))
    } finally {
      setEnviando(false)
    }
  }

  async function reenviar() {
    setErro(null)
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) setErro('Aguarde um pouco antes de pedir outro código.')
    else setReenviado(true)
  }

  return (
    <Tela>
      <Titulo>Confirme seu e-mail</Titulo>
      <Texto suave>Enviamos um código de 6 dígitos para {email}.</Texto>
      <Campo
        rotulo="Código"
        value={codigo}
        onChangeText={(texto) => setCodigo(texto.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
      />
      {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
      {reenviado ? <Mensagem tipo="sucesso">Enviamos um código novo.</Mensagem> : null}
      <Botao onPress={confirmar} carregando={enviando} desativado={codigo.length !== 6}>
        Confirmar
      </Botao>
      <Botao variante="fantasma" onPress={reenviar}>
        Reenviar código
      </Botao>
    </Tela>
  )
}
