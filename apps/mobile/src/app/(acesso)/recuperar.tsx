import { router } from 'expo-router'
import { useState } from 'react'
import { Botao, Campo, Mensagem, Tela, Texto, Titulo } from '../../componentes/ui'
import { supabase } from '../../lib/supabase'

// Figma Senha 01–03: e-mail → código → nova senha.
export default function Recuperar() {
  const [passo, setPasso] = useState<'email' | 'codigo' | 'senha'>('email')
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function executar(fn: () => Promise<string | null>) {
    setEnviando(true)
    setErro(null)
    const problema = await fn()
    setEnviando(false)
    if (problema) setErro(problema)
  }

  return (
    <Tela>
      {passo === 'email' ? (
        <>
          <Titulo>Recuperar a senha</Titulo>
          <Texto suave>Enviamos um código para o seu e-mail.</Texto>
          <Campo
            rotulo="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
          <Botao
            carregando={enviando}
            desativado={!email}
            onPress={() =>
              executar(async () => {
                const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
                if (error) return 'Não foi possível enviar o código. Confira o e-mail.'
                setPasso('codigo')
                return null
              })
            }
          >
            Enviar código
          </Botao>
        </>
      ) : passo === 'codigo' ? (
        <>
          <Titulo>Digite o código</Titulo>
          <Texto suave>Enviado para {email}.</Texto>
          <Campo
            rotulo="Código"
            value={codigo}
            onChangeText={(t) => setCodigo(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
          />
          {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
          <Botao
            carregando={enviando}
            desativado={codigo.length !== 6}
            onPress={() =>
              executar(async () => {
                const { error } = await supabase.auth.verifyOtp({
                  email: email.trim(),
                  token: codigo,
                  type: 'recovery',
                })
                if (error) return 'Código inválido ou vencido.'
                setPasso('senha')
                return null
              })
            }
          >
            Continuar
          </Botao>
        </>
      ) : (
        <>
          <Titulo>Nova senha</Titulo>
          <Campo
            rotulo="Nova senha"
            value={senha}
            onChangeText={setSenha}
            secureTextEntry
            ajuda="Mínimo de 8 caracteres."
          />
          {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
          <Botao
            carregando={enviando}
            desativado={senha.length < 8}
            onPress={() =>
              executar(async () => {
                const { error } = await supabase.auth.updateUser({ password: senha })
                if (error) return 'Não foi possível salvar a nova senha.'
                router.replace('/')
                return null
              })
            }
          >
            Salvar e entrar
          </Botao>
        </>
      )}
    </Tela>
  )
}
