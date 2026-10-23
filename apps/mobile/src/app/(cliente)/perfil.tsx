import { router } from 'expo-router'
import { useState } from 'react'
import { Botao, Campo, Mensagem, Subtitulo, Tela, Texto, Titulo } from '../../componentes/ui'
import { api, mensagemDe } from '../../lib/api'
import { soDigitos } from '../../lib/formato'
import { useSessao } from '../../lib/sessao'

// Figma Cliente 17 · Perfil: dados de contato (usados nos avisos e no WhatsApp da barbearia).
export default function Perfil() {
  const { perfil, recarregar, sair } = useSessao()
  const [nome, setNome] = useState(perfil?.cliente?.nome ?? '')
  const [celular, setCelular] = useState(perfil?.cliente?.celular ?? '')
  const [estado, setEstado] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    setSalvando(true)
    setEstado(null)
    try {
      await api('/api/clientes', {
        corpo: {
          nome: nome.trim(),
          ...(soDigitos(celular) ? { celular: soDigitos(celular) } : {}),
        },
      })
      await recarregar()
      setEstado({ tipo: 'sucesso', texto: 'Dados salvos.' })
    } catch (e) {
      setEstado({ tipo: 'erro', texto: mensagemDe(e) })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Tela>
      <Titulo>Perfil</Titulo>
      <Texto suave>{perfil?.email ?? ''}</Texto>
      <Campo rotulo="Nome" value={nome} onChangeText={setNome} />
      <Campo
        rotulo="Celular (WhatsApp)"
        value={celular}
        onChangeText={setCelular}
        keyboardType="phone-pad"
      />
      {estado ? <Mensagem tipo={estado.tipo}>{estado.texto}</Mensagem> : null}
      <Botao onPress={salvar} carregando={salvando} desativado={nome.trim().length < 2}>
        Salvar
      </Botao>
      <Subtitulo>Conta</Subtitulo>
      <Botao variante="secundario" onPress={() => router.push('/notificacoes')}>
        Notificações
      </Botao>
      <Botao
        variante="fantasma"
        onPress={async () => {
          await sair()
          router.replace('/entrar')
        }}
      >
        Sair
      </Botao>
    </Tela>
  )
}
