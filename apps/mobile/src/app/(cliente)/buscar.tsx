import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable } from 'react-native'
import { Campo, Cartao, Carregando, Mensagem, Tela, Texto, Vazio } from '../../componentes/ui'
import { api } from '../../lib/api'
import type { BarbeariaNaBusca } from '../../lib/tipos'
import { useCarregar } from '../../lib/useCarregar'

// Figma Cliente 04 · Busca: barbearias que escolheram aparecer nas buscas.
export default function Buscar() {
  const [termo, setTermo] = useState('')
  const [busca, setBusca] = useState('')
  const { dados, erro, carregando } = useCarregar(
    () => api<BarbeariaNaBusca[]>(`/api/vitrine?busca=${encodeURIComponent(busca)}`),
    [busca],
  )

  return (
    <Tela>
      <Campo
        rotulo="Buscar barbearia"
        placeholder="Nome, bairro ou cidade"
        value={termo}
        onChangeText={setTermo}
        onSubmitEditing={() => setBusca(termo.trim())}
        returnKeyType="search"
        onBlur={() => setBusca(termo.trim())}
      />
      {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
      {carregando ? (
        <Carregando />
      ) : dados && dados.length > 0 ? (
        dados.map((b) => (
          <Pressable
            key={b.slug}
            accessibilityRole="button"
            accessibilityLabel={`${b.nome}, ${[b.bairro, b.cidade].filter(Boolean).join(', ')}`}
            onPress={() => router.push(`/barbearia/${b.slug}`)}
          >
            <Cartao>
              <Texto forte>{b.nome}</Texto>
              <Texto suave>
                {[b.bairro, b.cidade].filter(Boolean).join(' · ') || 'Endereço não informado'}
              </Texto>
              <Texto pequeno suave>
                {b.nota !== null
                  ? `★ ${b.nota.toLocaleString('pt-BR')} · ${b.avaliacoes} avaliações`
                  : 'Sem avaliações ainda'}
                {b.aceitaAgendamentos ? '' : ' · agendamento online pausado'}
              </Texto>
            </Cartao>
          </Pressable>
        ))
      ) : (
        <Vazio titulo="Nenhuma barbearia encontrada">
          <Texto suave>Tente outro nome ou bairro.</Texto>
        </Vazio>
      )}
    </Tela>
  )
}
