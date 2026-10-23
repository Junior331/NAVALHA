import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Botao, Carregando, Mensagem, Tela, Texto, Titulo } from '../../componentes/ui'
import { api, mensagemDe } from '../../lib/api'
import { useSessao } from '../../lib/sessao'
import { useCarregar } from '../../lib/useCarregar'

// Figma Barbeiro 01–03 · Convite: o link do dono (Admin 04b) abre aqui; o barbeiro cria o
// acesso ou entra com a conta que já tem, e passa a fazer parte da equipe.
export default function Convite() {
  const { token } = useLocalSearchParams<{ token: string }>()
  const { sessao, recarregar } = useSessao()
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const {
    dados,
    erro: erroConvite,
    carregando,
  } = useCarregar(
    () => api<{ barbeariaNome: string; nome: string; expirado: boolean }>(`/api/convites/${token}`),
    [token],
  )

  async function aceitar() {
    setEnviando(true)
    setErro(null)
    try {
      await api(`/api/convites/${token}`, { metodo: 'POST', corpo: {} })
      await recarregar()
      router.replace('/')
    } catch (e) {
      setErro(mensagemDe(e))
    } finally {
      setEnviando(false)
    }
  }

  if (carregando) {
    return (
      <Tela rolar={false}>
        <Carregando />
      </Tela>
    )
  }
  if (!dados)
    return (
      <Tela>
        <Mensagem tipo="erro">{erroConvite ?? 'Convite não encontrado.'}</Mensagem>
      </Tela>
    )
  if (dados.expirado) {
    return (
      <Tela>
        <Titulo>Convite expirado</Titulo>
        <Texto>
          Este link já foi usado ou passou de 7 dias. Peça um novo ao dono da {dados.barbeariaNome}.
        </Texto>
      </Tela>
    )
  }
  return (
    <Tela>
      <Titulo>Olá, {dados.nome.split(' ')[0]}!</Titulo>
      <Texto>Você foi convidado para a equipe da {dados.barbeariaNome} no Navalha.</Texto>
      <Texto suave>
        Pelo app você vê sua agenda, inicia e conclui os atendimentos e acompanha sua produção.
      </Texto>
      {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
      {sessao ? (
        <Botao onPress={aceitar} carregando={enviando}>
          Entrar na equipe
        </Botao>
      ) : (
        <>
          <Botao onPress={() => router.push({ pathname: '/cadastro', params: { convite: token } })}>
            Criar meu acesso
          </Botao>
          <Botao variante="secundario" onPress={() => router.push('/entrar')}>
            Já tenho conta
          </Botao>
          <Texto pequeno suave>
            Depois de entrar, abra o link do convite de novo para aceitar.
          </Texto>
        </>
      )}
    </Tela>
  )
}
