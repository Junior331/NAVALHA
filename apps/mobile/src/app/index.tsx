import { Redirect } from 'expo-router'
import { Carregando, Tela } from '../componentes/ui'
import { useSessao } from '../lib/sessao'

// Porta de entrada: sem sessão vai para o login; equipe vai para a agenda; cliente para o início.
export default function Entrada() {
  const { sessao, perfil, carregando } = useSessao()
  if (carregando) {
    return (
      <Tela rolar={false}>
        <Carregando texto="Abrindo o Navalha…" />
      </Tela>
    )
  }
  if (!sessao) return <Redirect href="/entrar" />
  if (perfil?.membro) return <Redirect href="/hoje" />
  return <Redirect href="/inicio" />
}
