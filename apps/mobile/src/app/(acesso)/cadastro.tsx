import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Botao, Campo, Mensagem, Tela, Texto, Titulo } from '../../componentes/ui'
import { soDigitos } from '../../lib/formato'
import { supabase } from '../../lib/supabase'

// Figma Mobile 07 · Criar conta. O e-mail é confirmado por código (Mobile 08). Vindo de um
// convite, a conta entra na equipe em vez de virar cliente.
export default function Cadastro() {
  const { convite } = useLocalSearchParams<{ convite?: string }>()
  const [nome, setNome] = useState('')
  const [celular, setCelular] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [tentou, setTentou] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const erros = {
    nome: nome.trim().length >= 2 ? null : 'Informe seu nome',
    celular: [10, 11].includes(soDigitos(celular).length) ? null : 'Celular com DDD',
    email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) ? null : 'E-mail inválido',
    senha: senha.length >= 8 ? null : 'Mínimo de 8 caracteres',
  }

  async function criar() {
    setTentou(true)
    if (Object.values(erros).some(Boolean)) return
    setEnviando(true)
    setErro(null)
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: { data: { nome: nome.trim() } },
    })
    setEnviando(false)
    if (error) {
      setErro(
        error.code === 'user_already_exists'
          ? 'Já existe uma conta com esse e-mail. Entre com ela.'
          : 'Não foi possível criar a conta. Confira os dados.',
      )
      return
    }
    router.push({
      pathname: '/verificar',
      params: {
        email: email.trim(),
        nome: nome.trim(),
        celular: soDigitos(celular),
        ...(convite ? { convite } : {}),
      },
    })
  }

  return (
    <Tela>
      <Titulo>{convite ? 'Crie seu acesso de barbeiro' : 'Crie sua conta'}</Titulo>
      <Texto suave>Leva um minuto. Depois é só escolher a barbearia e o horário.</Texto>
      <Campo
        rotulo="Nome"
        value={nome}
        onChangeText={setNome}
        autoComplete="name"
        erro={tentou ? erros.nome : null}
      />
      <Campo
        rotulo="Celular (WhatsApp)"
        value={celular}
        onChangeText={setCelular}
        keyboardType="phone-pad"
        autoComplete="tel"
        erro={tentou ? erros.celular : null}
      />
      <Campo
        rotulo="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        erro={tentou ? erros.email : null}
      />
      <Campo
        rotulo="Senha"
        value={senha}
        onChangeText={setSenha}
        secureTextEntry
        autoComplete="new-password"
        ajuda="Mínimo de 8 caracteres."
        erro={tentou ? erros.senha : null}
      />
      {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
      <Botao onPress={criar} carregando={enviando}>
        Continuar
      </Botao>
    </Tela>
  )
}
