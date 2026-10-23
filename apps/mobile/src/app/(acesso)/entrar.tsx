import { Link, router } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Botao, Campo, Mensagem, Tela, Texto, Titulo } from '../../componentes/ui'
import { registrarParaPush } from '../../lib/push'
import { supabase } from '../../lib/supabase'
import { useCores } from '../../tema'

// Figma Mobile 05 · Entrar. A mesma conta serve para cliente e para quem é da equipe.
export default function Entrar() {
  const c = useCores()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function entrar() {
    setEnviando(true)
    setErro(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    })
    setEnviando(false)
    if (error) {
      setErro(
        error.code === 'email_not_confirmed'
          ? 'Confirme seu e-mail com o código que enviamos antes de entrar.'
          : 'E-mail ou senha incorretos.',
      )
      return
    }
    void registrarParaPush().catch(() => undefined)
    router.replace('/')
  }

  return (
    <Tela>
      <View style={estilos.marca}>
        <Text style={[estilos.logo, { color: c.marca }]}>✂</Text>
        <Titulo>Navalha</Titulo>
        <Texto suave>Agende, pague e acompanhe seus horários.</Texto>
      </View>
      <Campo
        rotulo="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <Campo
        rotulo="Senha"
        value={senha}
        onChangeText={setSenha}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        onSubmitEditing={entrar}
      />
      {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
      <Botao onPress={entrar} carregando={enviando} desativado={!email || !senha}>
        Entrar
      </Botao>
      <Link href="/recuperar" style={[estilos.link, { color: c.texto }]}>
        Esqueci a senha
      </Link>
      <View style={[estilos.separador, { borderTopColor: c.borda }]} />
      <Texto suave>Ainda não tem conta?</Texto>
      <Botao variante="secundario" onPress={() => router.push('/cadastro')}>
        Criar conta
      </Botao>
    </Tela>
  )
}

const estilos = StyleSheet.create({
  marca: { alignItems: 'center', gap: 4, marginTop: 32, marginBottom: 16 },
  logo: { fontSize: 40 },
  link: {
    textAlign: 'center',
    fontWeight: '600',
    paddingVertical: 12,
    textDecorationLine: 'underline',
  },
  separador: { borderTopWidth: 1, marginVertical: 8 },
})
