import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Linking } from 'react-native'
import {
  Botao,
  Cartao,
  Carregando,
  Mensagem,
  Opcao,
  Subtitulo,
  Tela,
  Texto,
  Titulo,
} from '../../componentes/ui'
import { api } from '../../lib/api'
import { minutosEmTexto, reais, soDigitos } from '../../lib/formato'
import type { PaginaDaBarbearia } from '../../lib/tipos'
import { useCarregar } from '../../lib/useCarregar'

// Figma Cliente 03 · Barbearia. Um rótulo só para entrar no fluxo ("Agendar horário"), e os
// serviços marcados aqui já seguem para o passo 2 (backlog 03).
export default function Barbearia() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const [escolhidos, setEscolhidos] = useState<string[]>([])
  const {
    dados: pagina,
    erro,
    carregando,
  } = useCarregar(() => api<PaginaDaBarbearia>(`/api/vitrine/${slug}`), [slug])

  if (carregando) {
    return (
      <Tela rolar={false}>
        <Carregando />
      </Tela>
    )
  }
  if (!pagina) {
    return (
      <Tela>
        <Mensagem tipo="erro">{erro ?? 'Barbearia não encontrada.'}</Mensagem>
      </Tela>
    )
  }

  const total = pagina.servicos
    .filter((s) => escolhidos.includes(s.id))
    .reduce((t, s) => t + s.precoCentavos, 0)
  const { politica } = pagina
  const whatsapp = soDigitos(pagina.whatsapp ?? '')

  return (
    <Tela
      rodape={
        pagina.aceitaAgendamentos ? (
          <Botao
            onPress={() =>
              router.push({
                pathname: '/agendar/[slug]',
                params: { slug: pagina.slug, servicos: escolhidos.join(',') },
              })
            }
          >
            {escolhidos.length ? `Agendar horário · ${reais(total)}` : 'Agendar horário'}
          </Botao>
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: pagina.nome }} />
      <Titulo>{pagina.nome}</Titulo>
      <Texto suave>
        {pagina.nota !== null
          ? `★ ${pagina.nota.toLocaleString('pt-BR')} · ${pagina.avaliacoes} avaliações`
          : 'Sem avaliações ainda'}
      </Texto>
      {pagina.endereco ? (
        <Texto suave>
          {[pagina.endereco, pagina.bairro, pagina.cidade].filter(Boolean).join(', ')}
        </Texto>
      ) : null}
      {pagina.descricao ? <Texto>{pagina.descricao}</Texto> : null}
      {whatsapp.length >= 10 ? (
        <Botao
          variante="secundario"
          onPress={() => void Linking.openURL(`https://wa.me/55${whatsapp.replace(/^55/, '')}`)}
        >
          Falar no WhatsApp
        </Botao>
      ) : null}
      {!pagina.aceitaAgendamentos ? (
        <Mensagem tipo="info">Os agendamentos online estão pausados nesta barbearia.</Mensagem>
      ) : null}

      <Subtitulo>Serviços</Subtitulo>
      {pagina.servicos.map((s) => (
        <Opcao
          key={s.id}
          titulo={s.nome}
          detalhe={minutosEmTexto(s.duracaoMin)}
          direita={reais(s.precoCentavos)}
          marcado={escolhidos.includes(s.id)}
          desativado={!pagina.aceitaAgendamentos}
          onPress={() =>
            setEscolhidos(
              escolhidos.includes(s.id)
                ? escolhidos.filter((id) => id !== s.id)
                : [...escolhidos, s.id],
            )
          }
        />
      ))}

      <Subtitulo>Cancelamento</Subtitulo>
      <Cartao>
        <Texto>
          Grátis até {politica.prazoGratisHoras}h antes. Depois disso, ou se você não vier,{' '}
          {politica.retencaoPct}% do valor fica com a barbearia. Atraso tolerado:{' '}
          {politica.toleranciaMin} minutos.
        </Texto>
      </Cartao>

      {pagina.barbeiros.length ? <Subtitulo>Equipe</Subtitulo> : null}
      {pagina.barbeiros.map((b) => (
        <Cartao key={b.id}>
          <Texto forte>{b.nome}</Texto>
          <Texto suave>
            {b.nota !== null
              ? `★ ${b.nota.toLocaleString('pt-BR')} · ${b.avaliacoes} avaliações`
              : 'Novo na equipe'}
          </Texto>
        </Cartao>
      ))}

      {pagina.depoimentos.length ? <Subtitulo>Avaliações</Subtitulo> : null}
      {pagina.depoimentos.map((d, i) => (
        <Cartao key={i}>
          <Texto>{'★'.repeat(d.nota)}</Texto>
          <Texto>{d.comentario}</Texto>
          <Texto pequeno suave>
            {d.cliente}
          </Texto>
        </Cartao>
      ))}
    </Tela>
  )
}
